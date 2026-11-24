import { expect, test } from "vitest"

import { examDetailOutput } from "@/schemas/mcp-output"
import { mcpHandler } from "@/server/mcp.server"

import { createExam, enroll, inDays } from "./fixtures"

/** Żądanie JSON-RPC jak klient 2025 (bezstanowo) z prowadzącym, którego trasa `/mcp` już sprawdziła. */
async function rpc(teacherId: string, method: string, params: object = {}) {
  const res = await mcpHandler.fetch(
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

const callTool = (teacherId: string, name: string, args: object = {}) =>
  rpc(teacherId, "tools/call", { name, arguments: args })

test("tools/list: trzy odczyty z adnotacjami; initialize podaje instructions", async () => {
  const { teacherId } = await createExam({ rosters: {} })
  const { tools } = await rpc(teacherId, "tools/list")
  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }
  expect(tools.map((t: { name: string }) => t.name).toSorted()).toEqual([
    "get_exam",
    "list_entry_emails",
    "list_exams",
  ])
  for (const t of tools) expect(t.annotations).toEqual(readOnly)

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
