import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { loadSchedule } from "@/server/exam-state.server"
import { copyExam, examCsv, examsOf, readExam, updateExamSettings } from "@/server/exam-ops.server"

import { createExam, enroll, inDays } from "./fixtures"

test("duplikat kopiuje ustawienia i listy, bez slotów i zapisów; bez list na życzenie", async () => {
  const { examId, teacherId } = await createExam({
    maxTeamSize: 3,
    fields: [{ id: "t", label: "Temat", required: true }],
    rosters: {
      g1: { students: ["1", "2"], slots: [inDays(1)] },
      g2: { students: ["3"], slots: [] },
    },
  })
  await enroll(examId, ["1"])
  await db.exam.update({ where: { id: examId }, data: { assignmentMode: "MANUAL" } })

  const copied = await copyExam(examId, teacherId, true)
  if (!copied.ok) throw new Error(copied.code)
  const copyId = copied.examId
  const copy = await db.exam.findUniqueOrThrow({
    where: { id: copyId },
    include: { rosters: { include: { entries: true } }, enrollments: true },
  })
  expect(copy).toMatchObject({
    name: "Kolokwium (kopia)",
    description: "Sala 1",
    maxTeamSize: 3,
    assignmentMode: "MANUAL",
    fields: [{ id: "t", label: "Temat", required: true }],
  })
  expect(
    copy.rosters
      .map((r) => [r.name, r.entries.length])
      .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["g1", 2],
    ["g2", 1],
  ])
  expect(copy.enrollments).toEqual([])
  expect(await db.slot.count({ where: { examId: copyId } })).toBe(0)

  const bare = await copyExam(examId, teacherId, false)
  if (!bare.ok) throw new Error(bare.code)
  expect(await db.roster.count({ where: { examId: bare.examId } })).toBe(0)

  const stranger = await createExam({ rosters: {} })
  expect(await copyExam(examId, stranger.teacherId, true)).toEqual({ ok: false, code: "NOT_FOUND" })
})

test("edycja po starcie: zespół nie mniejszy niż największy istniejący; reszta zmienia się od razu", async () => {
  const { examId, teacherId } = await createExam({
    maxTeamSize: 3,
    rosters: { g1: { students: ["1", "2", "3"], slots: [inDays(1), inDays(2)] } },
  })
  await enroll(examId, ["1", "2"])
  const settings = {
    name: "Nowa",
    description: "Sala 9",
    defaultSlotMinutes: 45,
    assignmentMode: "MANUAL" as const,
    fields: [],
  }
  const opens = { opensDate: "2030-01-07", opensTime: "08:30" }

  expect(
    await updateExamSettings(examId, teacherId, { ...settings, ...opens, maxTeamSize: 1 }),
  ).toMatchObject({
    ok: false,
    code: "TEAM_SIZE_BELOW_EXISTING",
  })
  expect(
    await updateExamSettings(examId, teacherId, { ...settings, ...opens, maxTeamSize: 2 }),
  ).toEqual({
    ok: true,
  })
  expect(await db.exam.findUnique({ where: { id: examId } })).toMatchObject({
    ...settings,
    maxTeamSize: 2,
    enrollmentOpensAt: new Date("2030-01-07T07:30:00Z"),
  })
  const slots = await db.slot.findMany({ where: { examId } })
  expect(slots.every((s) => s.endsAt.getTime() - s.startsAt.getTime() === 30 * 60_000)).toBe(true)
})

test("prowadzący widzi i eksportuje tylko swoje zaliczenia", async () => {
  const mine = await createExam({ rosters: { g1: { students: ["1"], slots: [inDays(1)] } } })
  const other = await createExam({ rosters: {} })
  await enroll(mine.examId, ["1"])

  expect((await examsOf(mine.teacherId)).map((e) => e.id)).toEqual([mine.examId])
  expect(await readExam(mine.examId, mine.teacherId)).toMatchObject({ id: mine.examId })
  expect(await readExam(mine.examId, other.teacherId)).toBeNull()
  expect(await examCsv(mine.examId, other.teacherId)).toEqual({ ok: false, code: "NOT_FOUND" })
  const csv = await examCsv(mine.examId, mine.teacherId)
  if (!csv.ok) throw new Error(csv.code)
  expect(csv.csv).toContain("1")
})

test("harmonogram pokazuje zespół bez numerów indeksów", async () => {
  const { examId } = await createExam({
    rosters: { g1: { students: ["123456"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["123456"])

  const schedule = await loadSchedule(examId)
  const team = schedule!.slots[0]!.team
  expect(team).toHaveLength(1)
  expect(Object.keys(team[0]!).toSorted()).toEqual(["firstName", "lastName"])
})
