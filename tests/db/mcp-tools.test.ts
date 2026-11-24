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
  freeSlotsDeletedOutput,
  slotWindowOutput,
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
  board_command: [false, false, false],
  add_slot_window: [false, false, false],
  update_slot: [false, false, true],
  delete_slot: [false, true, false],
  delete_free_slots_of_day: [false, true, false],
  preview_roster_import: [true, false, true],
  apply_roster_import: [false, true, false],
  add_roster_entry: [false, false, false],
  delete_roster_entry: [false, false, false],
  delete_roster: [false, true, false],
  set_entry_email: [false, false, true],
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

const ok = { isError: false, structuredContent: {} }

test("sloty: add_slot_window, update_slot, delete_free_slots_of_day — wyniki zgodne z outputSchema", async () => {
  const { examId, teacherId, rosterIds } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["1"])
  const rosterId = rosterIds.g1!
  const slotsOn = async (day: string) =>
    examDetailOutput
      .parse((await callTool(teacherId, "get_exam", { examId })).structuredContent)
      .slots.filter((s) => s.startsAt.startsWith(day))

  const added = await callTool(teacherId, "add_slot_window", {
    examId,
    rosterId,
    date: "2030-01-03",
    from: "10:00",
    to: "11:00",
    minutes: 20,
  })
  expect(added.isError).toBe(false)
  expect(slotWindowOutput.parse(added.structuredContent)).toEqual({ count: 3 })

  const [first] = await slotsOn("2030-01-03")
  expect(
    await callTool(teacherId, "update_slot", {
      examId,
      slotId: first!.id,
      rosterId,
      date: "2030-01-03",
      from: "12:00",
      to: "12:30",
    }),
  ).toMatchObject(ok)
  expect((await slotsOn("2030-01-03")).map((s) => s.startsAt)).toContain(
    "2030-01-03T12:00:00+01:00",
  )

  const freed = await callTool(teacherId, "delete_free_slots_of_day", { examId, day: "2030-01-03" })
  expect(freed.isError).toBe(false)
  expect(freeSlotsDeletedOutput.parse(freed.structuredContent)).toEqual({ deleted: 3, skipped: 0 })
  const kept = await callTool(teacherId, "delete_free_slots_of_day", { examId, day: "2030-01-02" })
  expect(freeSlotsDeletedOutput.parse(kept.structuredContent)).toEqual({ deleted: 0, skipped: 1 })
})

test("listy: add_roster_entry, set_entry_email, delete_roster_entry, delete_roster — wyniki zgodne z outputSchema", async () => {
  const { examId, teacherId, rosterIds } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  const rosterId = rosterIds.g1!
  const exam = async () =>
    examDetailOutput.parse((await callTool(teacherId, "get_exam", { examId })).structuredContent)

  expect(
    await callTool(teacherId, "add_roster_entry", {
      examId,
      rosterId,
      studentNumber: "2",
      firstName: "Ala",
      lastName: "Nowak",
      email: "",
    }),
  ).toMatchObject(ok)
  expect((await exam()).people).toContainEqual(
    expect.objectContaining({ studentNumber: "2", firstName: "Ala", lastName: "Nowak" }),
  )

  expect(
    await callTool(teacherId, "set_entry_email", {
      examId,
      studentNumber: "2",
      email: "ala@example.com",
    }),
  ).toMatchObject(ok)
  const { emails } = (await callTool(teacherId, "list_entry_emails", { examId })).structuredContent
  expect(emails["2"]).toBe("ala@example.com")

  expect(
    await callTool(teacherId, "delete_roster_entry", { examId, studentNumber: "2" }),
  ).toMatchObject(ok)
  expect((await exam()).people.map((p) => p.studentNumber)).toEqual(["1"])

  expect(await callTool(teacherId, "delete_roster", { examId, rosterId })).toMatchObject(ok)
  expect((await exam()).rosters).toEqual([])
})
