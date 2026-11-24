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

const READ = { readOnlyHint: true, idempotentHint: true }
const IDEMPOTENT = { idempotentHint: true }
const DESTRUCTIVE = { destructiveHint: true }

/** Adnotacje z tabeli w spec §6; brak flagi = jawne `false`. */
const ANNOTATIONS: Record<string, object> = {
  list_exams: READ,
  get_exam: READ,
  list_entry_emails: READ,
  board_command: {},
  add_slot_window: {},
  update_slot: IDEMPOTENT,
  delete_slot: DESTRUCTIVE,
  delete_free_slots_of_day: DESTRUCTIVE,
  preview_roster_import: READ,
  apply_roster_import: DESTRUCTIVE,
  add_roster_entry: {},
  delete_roster_entry: {},
  delete_roster: DESTRUCTIVE,
  set_entry_email: IDEMPOTENT,
}

test("tools/list: każde narzędzie z adnotacjami z tabeli; initialize podaje instructions", async () => {
  const { teacherId } = await createExam({ rosters: {} })
  const { tools } = await rpc(teacherId, "tools/list")
  const off = { destructiveHint: false, idempotentHint: false, openWorldHint: false }
  expect(
    Object.fromEntries(
      tools.map((t: { name: string; annotations: object }) => [t.name, t.annotations]),
    ),
  ).toEqual(
    Object.fromEntries(Object.entries(ANNOTATIONS).map(([name, a]) => [name, { ...off, ...a }])),
  )

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

test("board_command: setGrades, potem jego inverse — ocena wraca do poprzedniej", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["1"])
  const person = async () =>
    (await callTool(teacherId, "get_exam", { examId })).structuredContent.people[0]
  expect(await person()).toMatchObject({ grade: null, gradeComment: null })

  const set = await callTool(teacherId, "board_command", {
    examId,
    command: { kind: "setGrades", grades: { "1": { grade: "G4", gradeComment: "dobrze" } } },
  })
  expect(set.isError).toBe(false)
  expect(await person()).toMatchObject({ grade: "G4", gradeComment: "dobrze" })

  const undo = await callTool(teacherId, "board_command", {
    examId,
    command: set.structuredContent.inverse,
  })
  expect(undo.isError).toBe(false)
  expect(await person()).toMatchObject({ grade: null, gradeComment: null })
})

test("import listy: apply z withdrawnEnrolled z podglądu; zmiana zapisów od podglądu → IMPORT_PREVIEW_STALE", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1", "2", "3"], slots: [inDays(1), inDays(2)] } },
  })
  await enroll(examId, ["1"])
  const csv = ["indeks;imie;nazwisko;skreslony", "1;A;A;1", "2;B;B;1", "3;C;C;0"].join("\n")
  const args = { examId, rosterName: "g1", csv }
  const previewed = async (): Promise<string[]> => {
    const preview = await callTool(teacherId, "preview_roster_import", args)
    expect(preview.isError).toBe(false)
    return preview.structuredContent.withdrawnEnrolled.map(
      (e: { studentNumber: string }) => e.studentNumber,
    )
  }

  const stale = await previewed()
  expect(stale).toEqual(["1"])
  await enroll(examId, ["2"])
  expect(
    await callTool(teacherId, "apply_roster_import", { ...args, withdrawnEnrolled: stale }),
  ).toMatchObject({ isError: true, structuredContent: { code: "IMPORT_PREVIEW_STALE" } })

  const applied = await callTool(teacherId, "apply_roster_import", {
    ...args,
    withdrawnEnrolled: await previewed(),
  })
  expect(applied).toMatchObject({ isError: false, structuredContent: {} })
  const { emails } = (await callTool(teacherId, "list_entry_emails", { examId })).structuredContent
  expect(Object.keys(emails)).toEqual(["3"])
})

test("delete_slot: slot z zapisem → SLOT_HAS_ENROLLMENTS", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["1"])
  const { slots } = (await callTool(teacherId, "get_exam", { examId })).structuredContent
  expect(await callTool(teacherId, "delete_slot", { examId, slotId: slots[0].id })).toMatchObject({
    isError: true,
    structuredContent: { code: "SLOT_HAS_ENROLLMENTS" },
  })
})
