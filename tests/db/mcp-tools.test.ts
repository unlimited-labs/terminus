import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { consola } from "consola"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { ACCESS_DENIED, errorMessage, UNEXPECTED_ERROR } from "@/messages.pl"
import {
  createExamOutput,
  emptyOutput,
  examCsvOutput,
  examDetailOutput,
} from "@/schemas/mcp-output"
import { db } from "@/server/db.server"
import { mcpHandler } from "@/server/mcp.server"
import { mcpCaller, toolRegistrar } from "@/server/mcp-tools.server"

import { createExam, enroll, inDays } from "./fixtures"

/** Żądanie JSON-RPC jak klient 2025 (bezstanowo) z prowadzącym, którego trasa `/mcp` już sprawdziła. */
async function rpc(teacherId: string, method: string, params: object = {}, handler = mcpHandler) {
  const res = await handler.fetch(
    new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    {
      authInfo: {
        token: "",
        clientId: "https://klient.example.com/cimd.json",
        scopes: [],
        extra: {
          user: { id: teacherId, email: "p@example.com" },
          clientHost: "klient.example.com",
        },
      },
    },
  )
  const data = (await res.text()).match(/^data: (.*)$/m)?.[1]
  return JSON.parse(data ?? "null").result
}

const callTool = (teacherId: string, name: string, args: object = {}, handler = mcpHandler) =>
  rpc(teacherId, "tools/call", { name, arguments: args }, handler)

test("wyjątek w funkcji: brak dostępu → NOT_FOUND, inny → ogólny komunikat bez jego treści", async () => {
  const handler = createMcpHandler(
    ({ authInfo }) => {
      const server = new McpServer({ name: "test", version: "1" })
      const tool = toolRegistrar(server, mcpCaller.parse(authInfo?.extra))
      const config = {
        title: "",
        description: "",
        inputSchema: z.object({}),
        outputSchema: emptyOutput,
        annotations: {},
      }
      tool("denied", config, () => Promise.reject(new Error(ACCESS_DENIED)))
      tool("broken", config, () => Promise.reject(new Error("tajny szczegół bazy")))
      return server
    },
    { legacy: "stateless", responseMode: "json" },
  )
  vi.spyOn(consola, "warn").mockImplementation(() => {})
  const error = vi.spyOn(consola, "error").mockImplementation(() => {})

  expect(await callTool("t1", "denied", {}, handler)).toEqual({
    isError: true,
    content: [{ type: "text", text: errorMessage({ code: "NOT_FOUND" }) }],
    structuredContent: { code: "NOT_FOUND" },
  })
  expect(await callTool("t1", "broken", {}, handler)).toEqual({
    isError: true,
    content: [{ type: "text", text: UNEXPECTED_ERROR }],
  })
  expect(String(error.mock.calls[0]?.[0])).toContain("mcp:broken")
})

/** Tabela §6 speca: [readOnlyHint, destructiveHint, idempotentHint]; jeden wiersz na narzędzie. */
const ANNOTATIONS: Record<string, [boolean, boolean, boolean]> = {
  list_exams: [true, false, true],
  get_exam: [true, false, true],
  create_exam: [false, false, false],
  update_exam: [false, false, true],
  delete_exam: [false, true, false],
  copy_exam: [false, false, false],
  add_exam_teacher: [false, false, false],
  remove_exam_teacher: [false, true, false],
  export_exam_csv: [true, false, true],
  list_entry_emails: [true, false, true],
}

test("tools/list: adnotacje z tabeli §6; initialize podaje instructions", async () => {
  const { teacherId } = await createExam({ rosters: {} })
  const { tools } = await rpc(teacherId, "tools/list")
  const listed = Object.fromEntries(
    tools.map((t: { name: string; annotations: object }) => [t.name, t.annotations]),
  )
  const expected = Object.fromEntries(
    Object.entries(ANNOTATIONS).map(([name, [readOnlyHint, destructiveHint, idempotentHint]]) => [
      name,
      { readOnlyHint, destructiveHint, idempotentHint, openWorldHint: false },
    ]),
  )
  expect(listed).toEqual(expected)
  // MCP wymaga obiektu w korzeniu `inputSchema` (`update_exam` to przecięcie dwóch schematów).
  for (const t of tools) expect([t.name, t.inputSchema.type]).toEqual([t.name, "object"])

  const init = await rpc(teacherId, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  })
  expect(init.instructions).toContain("list_exams")
})

test("get_exam: swoje zaliczenie z linkiem i datami po warszawsku; cudze → NOT_FOUND", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1", "2"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["1"])
  const own = await callTool(teacherId, "get_exam", { examId })
  expect(own.isError).toBe(false)
  const exam = examDetailOutput.parse(own.structuredContent)
  expect(exam).toMatchObject({ id: examId, link: `http://localhost:3000/z/${examId}` })
  expect(exam.slots[0]?.startsAt).toBe("2030-01-02T10:00:00+01:00")

  const other = await createExam({ rosters: {} })
  expect(await callTool(other.teacherId, "get_exam", { examId })).toMatchObject({
    isError: true,
    structuredContent: { code: "NOT_FOUND" },
  })
})

test("list_exams i list_entry_emails: tylko swoje zaliczenia", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["123456"], slots: [] } },
  })
  const listed = await callTool(teacherId, "list_exams")
  expect(listed.structuredContent.exams).toEqual([
    expect.objectContaining({ id: examId, name: "Kolokwium", phase: "draft" }),
  ])

  const emails = await callTool(teacherId, "list_entry_emails", { examId })
  expect(emails.structuredContent).toEqual({
    emails: { "123456": "123456@student.agh.edu.pl" },
  })
  const other = await createExam({ rosters: {} })
  expect(await callTool(other.teacherId, "list_entry_emails", { examId })).toMatchObject({
    isError: true,
    structuredContent: { code: "NOT_FOUND" },
  })
})

const examForm = {
  name: "Egzamin",
  description: "",
  defaultSlotMinutes: 20,
  maxTeamSize: 1,
  assignmentMode: "RANDOM",
  requireEmailLogin: false,
  showSlotTimes: true,
  fields: [],
  opensDate: "",
  opensTime: "",
}

const notFound = { isError: true, structuredContent: { code: "NOT_FOUND" } }

test("create_exam i update_exam: nowe zaliczenie, zmiana ustawień; cudze → NOT_FOUND", async () => {
  const { teacherId } = await createExam({ rosters: {} })
  const created = await callTool(teacherId, "create_exam", examForm)
  expect(created.isError).toBe(false)
  const { examId } = createExamOutput.parse(created.structuredContent)
  const exam = await callTool(teacherId, "get_exam", { examId })
  expect(exam.structuredContent).toMatchObject({ name: "Egzamin" })

  const updated = await callTool(teacherId, "update_exam", { ...examForm, name: "Nowa", examId })
  expect(updated).toMatchObject({ isError: false, structuredContent: {} })
  const renamed = await callTool(teacherId, "get_exam", { examId })
  expect(renamed.structuredContent).toMatchObject({ name: "Nowa" })

  const other = await createExam({ rosters: {} })
  expect(await callTool(other.teacherId, "update_exam", { ...examForm, examId })).toMatchObject(
    notFound,
  )
})

test("delete_exam: zła nazwa → NAME_MISMATCH, cudze → NOT_FOUND, dobra usuwa", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })
  expect(
    await callTool(other.teacherId, "delete_exam", { examId, confirmName: "Kolokwium" }),
  ).toMatchObject(notFound)
  expect(await callTool(teacherId, "delete_exam", { examId, confirmName: "Inne" })).toMatchObject({
    isError: true,
    structuredContent: { code: "NAME_MISMATCH" },
  })
  expect(
    await callTool(teacherId, "delete_exam", { examId, confirmName: "Kolokwium" }),
  ).toMatchObject({ isError: false, structuredContent: {} })
  expect(await callTool(teacherId, "get_exam", { examId })).toMatchObject(notFound)
})

test("copy_exam: kopia z listami; cudze → NOT_FOUND", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  const copied = await callTool(teacherId, "copy_exam", { examId, copyRosters: true })
  const copy = createExamOutput.parse(copied.structuredContent)
  const exam = await callTool(teacherId, "get_exam", { examId: copy.examId })
  expect(exam.structuredContent).toMatchObject({
    name: "Kolokwium (kopia)",
    rosters: [expect.objectContaining({ name: "g1" })],
  })

  const other = await createExam({ rosters: {} })
  expect(
    await callTool(other.teacherId, "copy_exam", { examId, copyRosters: false }),
  ).toMatchObject(notFound)
})

test("add_exam_teacher i remove_exam_teacher: współprowadzący po e-mailu; cudze → NOT_FOUND", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })
  const { email } = await db.user.findUniqueOrThrow({ where: { id: other.teacherId } })

  expect(await callTool(teacherId, "add_exam_teacher", { examId, email })).toMatchObject({
    isError: false,
    structuredContent: {},
  })
  const exam = examDetailOutput.parse(
    (await callTool(other.teacherId, "get_exam", { examId })).structuredContent,
  )
  expect(exam.teachers.map((t) => t.id).toSorted()).toEqual([teacherId, other.teacherId].toSorted())

  expect(
    await callTool(teacherId, "remove_exam_teacher", { examId, teacherId: other.teacherId }),
  ).toMatchObject({ isError: false, structuredContent: {} })
  expect(
    await callTool(other.teacherId, "remove_exam_teacher", { examId, teacherId }),
  ).toMatchObject(notFound)
  expect(await callTool(other.teacherId, "add_exam_teacher", { examId, email })).toMatchObject(
    notFound,
  )
})

test("export_exam_csv: plik CSV w wyniku; cudze → NOT_FOUND", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["123456"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["123456"])
  const exported = await callTool(teacherId, "export_exam_csv", { examId })
  const { fileName, csv } = examCsvOutput.parse(exported.structuredContent)
  expect(fileName).toMatch(/\.csv$/)
  expect(csv).toContain("123456")

  const other = await createExam({ rosters: {} })
  expect(await callTool(other.teacherId, "export_exam_csv", { examId })).toMatchObject(notFound)
})
