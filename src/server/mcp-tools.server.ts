import type {
  CallToolResult,
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from "@modelcontextprotocol/server"
import { RateLimiterMemory } from "rate-limiter-flexible"
import { z } from "zod"

import { warsawIso } from "../domain/time.ts"
import { ACCESS_DENIED, errorMessage, type Result, UNEXPECTED_ERROR } from "../messages.pl.ts"

import { logCall } from "./call-log.server.ts"

/** Kto woła narzędzia: prowadzący (`teacherById`) i host klienta z jego `client_id`; trasa `/mcp` kładzie to w `authInfo.extra`. */
export const mcpCaller = z.object({
  user: z.object({ id: z.string(), email: z.string() }),
  clientHost: z.string(),
})

export type McpCaller = z.infer<typeof mcpCaller>

// shortcut: licznik w pamięci jednego procesu (zerowany po restarcie, osobny na replikę), przenieść do Postgresa/Redisa przy więcej niż jednej instancji
const calls = new RateLimiterMemory({ points: 120, duration: 60 })

const NOT_FOUND: Result = { ok: false, code: "NOT_FOUND" }

/** `Date` z Prismy → ISO po warszawsku, w głąb obiektów i tablic (JSON Schema nie zna `Date`). */
const withIsoDates = (value: unknown): unknown => {
  if (value instanceof Date) return warsawIso(value)
  if (Array.isArray(value)) return value.map(withIsoDates)
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withIsoDates(v)]))
  return value
}

function toolResult(result: Result): CallToolResult {
  const { ok, ...rest } = result
  const payload = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, withIsoDates(v)]))
  // Klienci 2025 bez obsługi `structuredContent` czytają tylko `content`.
  const text = ok ? JSON.stringify(payload) : errorMessage(result)
  return { isError: !ok, content: [{ type: "text", text }], structuredContent: payload }
}

/**
 * Rejestracja narzędzi prowadzącego: `run` woła funkcję `*-ops.server.ts` i zwraca jej `Result`
 * (odczyt owija w `{ ok: true, … }`; `null` = cudze albo nie ma).
 */
export function toolRegistrar(server: McpServer, { user, clientHost }: McpCaller) {
  return function tool<I extends z.ZodType>(
    name: string,
    config: {
      title: string
      description: string
      inputSchema: I
      outputSchema: StandardSchemaWithJSON
      annotations: ToolAnnotations
    },
    run: (input: z.output<I>) => Promise<Result | null>,
  ) {
    const write = !config.annotations.readOnlyHint
    const annotations = {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      ...config.annotations,
    }
    server.registerTool<StandardSchemaWithJSON, StandardSchemaWithJSON>(
      name,
      { ...config, annotations },
      // SDK już sprawdził wejście; ponowne `parse` tylko nadaje mu typ schematu.
      async (args) => {
        const input = config.inputSchema.parse(args)
        try {
          const { result } = await logCall(
            { name: `mcp:${name}`, write, data: input },
            async () => {
              const allowed = await calls.consume(user.id).then(
                () => true,
                () => false,
              )
              const outcome: Result = allowed
                ? ((await run(input)) ?? NOT_FOUND)
                : { ok: false, code: "TOO_MANY_CALLS" }
              // Kształt wyniku middleware funkcji serwerowej: z niego `logCall` czyta, kto i z jakim kodem odmowy.
              return {
                context: { user: { email: `${user.email} ${clientHost}` } },
                result: outcome,
              }
            },
          )
          return toolResult(result)
        } catch (e) {
          // `logCall` już zapisał wyjątek; SDK oddałby klientowi jego treść.
          if (e instanceof Error && e.message === ACCESS_DENIED) return toolResult(NOT_FOUND)
          return { isError: true, content: [{ type: "text", text: UNEXPECTED_ERROR }] }
        }
      },
    )
  }
}
