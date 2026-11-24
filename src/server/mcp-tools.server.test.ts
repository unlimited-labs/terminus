import { randomUUID } from "node:crypto"

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { consola } from "consola"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { toolRegistrar } from "./mcp-tools.server"

/** Serwer z jednym narzędziem `echo`, które zwraca to, co dostało w `result` (Date jako ISO z `dates`). */
function echoServer(userId: string = randomUUID()) {
  return createMcpHandler(
    () => {
      const server = new McpServer({ name: "test", version: "0" })
      const tool = toolRegistrar(server, {
        user: { id: userId, email: "a@b.pl" },
        clientHost: "x.pl",
      })
      tool(
        "echo",
        {
          title: "Echo",
          description: "Zwraca wynik z argumentu.",
          inputSchema: z.object({ result: z.any(), dates: z.array(z.string()).optional() }),
          outputSchema: z.looseObject({}),
          annotations: { readOnlyHint: true },
        },
        async ({ result, dates = [] }) =>
          result === null ? null : { ...result, dates: dates.map((d) => new Date(d)) },
      )
      return server
    },
    { responseMode: "json" },
  )
}

/** `tools/call` jak klient 2025 (bezstanowo); odpowiedź przychodzi jako jedno zdarzenie SSE. */
async function call(handler: ReturnType<typeof echoServer>, args: object) {
  const res = await handler.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "echo", arguments: args },
      }),
    }),
  )
  const data = (await res.text()).match(/^data: (.*)$/m)?.[1]
  return JSON.parse(data ?? "null").result
}

test("błąd domenowy → isError, polski komunikat i code z polami błędu", async () => {
  const result = await call(echoServer(), { result: { ok: false, code: "NAME_MISMATCH" } })
  expect(result).toMatchObject({
    isError: true,
    content: [{ type: "text", text: "Wpisana nazwa nie zgadza się z nazwą zaliczenia." }],
    structuredContent: { code: "NAME_MISMATCH" },
  })
})

test("null z odczytu → NOT_FOUND", async () => {
  const result = await call(echoServer(), { result: null })
  expect(result).toMatchObject({ isError: true, structuredContent: { code: "NOT_FOUND" } })
})

test("sukces bez ok; daty w czasie polskim z offsetem: +01:00 zimą, +02:00 latem", async () => {
  const result = await call(echoServer(), {
    result: { ok: true, examId: "e1" },
    dates: ["2026-12-01T09:20:00Z", "2026-06-01T08:20:00Z"],
  })
  const expected = {
    examId: "e1",
    dates: ["2026-12-01T10:20:00+01:00", "2026-06-01T10:20:00+02:00"],
  }
  expect(result.structuredContent).toEqual(expected)
  expect(JSON.parse(result.content[0].text)).toEqual(expected)
})

test("log: mcp:<narzędzie>, e-mail prowadzącego, host klienta, odmowa; odczyt na poziomie debug", async () => {
  const debug = vi.spyOn(consola, "debug").mockImplementation(() => {})
  await call(echoServer(), { result: { ok: false, code: "NOT_FOUND" } })
  expect(String(debug.mock.calls.at(-1)?.[0])).toMatch(
    /^mcp:echo a@b\.pl x\.pl odmowa:NOT_FOUND \d+ms$/,
  )
})

test("limit 120 wywołań na minutę na prowadzącego; drugi prowadzący liczy osobno", async () => {
  const handler = echoServer("limitowany")
  const ok = { result: { ok: true } }
  for (let i = 0; i < 120; i++) expect((await call(handler, ok)).isError).toBe(false)
  expect(await call(handler, ok)).toMatchObject({
    isError: true,
    content: [{ type: "text", text: "Za dużo wywołań, spróbuj za chwilę." }],
    structuredContent: { code: "TOO_MANY_CALLS" },
  })
  expect((await call(echoServer("inny"), ok)).isError).toBe(false)
})
