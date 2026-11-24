import { requireMcpAuth } from "@better-auth/mcp"
import { createResourceServerChallenge } from "@better-auth/oauth-provider"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { APIError } from "better-auth/api"
import { z } from "zod"

import { examIdSchema } from "../schemas/exam.ts"
import { entryEmailsOutput, examDetailOutput, listExamsOutput } from "../schemas/mcp-output.ts"

import { auth, MCP_RESOURCE, teacherById } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { env } from "./env.server.ts"
import { examsOf, readExam } from "./exam-ops.server.ts"
import { mcpCaller, toolRegistrar, type McpCaller } from "./mcp-tools.server.ts"
import { entryEmails } from "./roster-ops.server.ts"

const INSTRUCTIONS = [
  "Terminus: zapisy studentów na zaliczenia.",
  "Identyfikator zaliczenia (`examId`) weź z `list_exams`.",
  "Zanim cokolwiek zmienisz, przeczytaj `get_exam` — tam są identyfikatory slotów, list i numery indeksów.",
  "Wszystkie godziny są w czasie polskim.",
  "Zmianę na tablicy cofniesz, podając zwrócone `inverse` do `board_command`.",
  "Import listy to dwa kroki: `preview_roster_import`, pokaż podgląd prowadzącemu, potem `apply_roster_import`.",
].join(" ")

const READ = { readOnlyHint: true, idempotentHint: true }

/** Serwer MCP na jedno żądanie; prowadzącego i host klienta podaje trasa `/mcp` w `authInfo.extra`. */
export const mcpHandler = createMcpHandler(
  ({ authInfo }) => {
    const server = new McpServer(
      { name: "terminus", version: "1.0.0" },
      { instructions: INSTRUCTIONS },
    )
    const caller = mcpCaller.parse(authInfo?.extra)
    const { user } = caller
    const tool = toolRegistrar(server, caller)

    tool(
      "list_exams",
      {
        title: "Lista zaliczeń",
        description:
          "Zaliczenia, które prowadzę, od najnowszych: etap, liczba osób na listach i zapisanych, terminy slotów.",
        inputSchema: z.object({}),
        outputSchema: listExamsOutput,
        annotations: READ,
      },
      async () => ({ ok: true, exams: await examsOf(user.id) }),
    )

    tool(
      "get_exam",
      {
        title: "Zaliczenie",
        description:
          "Pełny stan zaliczenia: ustawienia, prowadzący, listy indeksów, sloty, osoby z zapisem i oceną, link do strony zapisów.",
        inputSchema: examIdSchema,
        outputSchema: examDetailOutput,
        annotations: READ,
      },
      async ({ examId }) => {
        const exam = await readExam(examId, user.id)
        return exam && { ok: true, ...exam, link: new URL(`/z/${examId}`, env.APP_PUBLIC_URL).href }
      },
    )

    tool(
      "list_entry_emails",
      {
        title: "Adresy e-mail z list",
        description: "Adresy e-mail osób z list indeksów zaliczenia, po numerze indeksu.",
        inputSchema: examIdSchema,
        outputSchema: entryEmailsOutput,
        annotations: READ,
      },
      async ({ examId }) => {
        const emails = await entryEmails(examId, user.id)
        return emails && { ok: true, emails }
      },
    )

    return server
  },
  { legacy: "stateless", responseMode: "json" },
)

/** 401 jak przy złym tokenie: klient z `WWW-Authenticate` wraca do logowania i zgody. */
function unauthorized() {
  const challenge = createResourceServerChallenge(
    new APIError("UNAUTHORIZED", { message: "invalid_token" }),
    MCP_RESOURCE,
  )
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "invalid_token" }, id: null },
    { status: 401, headers: challenge?.headers },
  )
}

const hostOf = (clientId: string) => (URL.canParse(clientId) ? new URL(clientId).host : clientId)

/**
 * `POST /mcp`: podpis i `aud` tokenu, potem przy każdym żądaniu konto (`teacherById`) i zgoda na
 * klienta — zablokowanie, utrata 2FA i odłączenie agenta działają od razu, nie po wygaśnięciu tokenu.
 */
export const serveMcp = requireMcpAuth(
  auth,
  async (request, claims) => {
    const clientId = String(claims.azp)
    const user = claims.sub ? await teacherById(claims.sub) : null
    const consent =
      user &&
      (await db.oauthConsent.findFirst({
        where: { userId: user.id, clientId },
        select: { id: true },
      }))
    if (!user || !consent) return unauthorized()
    return mcpHandler.fetch(request, {
      authInfo: {
        token: "",
        clientId,
        scopes: [],
        expiresAt: claims.exp,
        extra: { user, clientHost: hostOf(clientId) } satisfies McpCaller,
      },
    })
  },
  // Token ma `iss` = domena (`jwt.issuer`); domyślny issuer tutaj to `…/api/auth`.
  { resource: MCP_RESOURCE, issuer: new URL(env.APP_PUBLIC_URL).origin },
)
