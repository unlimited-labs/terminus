import { expect, test } from "vitest"

import { runBoardCommand, setSlotAnswers } from "@/server/board-ops.server"
import { db } from "@/server/db.server"
import { enrollTeam } from "@/server/enrollment.server"

import { createExam, inDays } from "./fixtures"

const fields = [
  { id: "title", label: "Tytuł projektu", required: true },
  { id: "notes", label: "Uwagi", required: false },
]

async function setup() {
  const fixture = await createExam({
    maxTeamSize: 2,
    fields,
    rosters: { g1: { students: ["1", "2", "3", "4"], slots: [inDays(1), inDays(2), inDays(3)] } },
  })
  const answersOf = async (studentNumber: string) =>
    (
      await db.enrollment.findUnique({
        where: { examId_studentNumber: { examId: fixture.examId, studentNumber } },
      })
    )?.answers
  return { ...fixture, answersOf }
}

test("zapis wymaga wymaganych pól i zapisuje odpowiedzi całemu zespołowi; bilet je pokazuje", async () => {
  const { examId, answersOf } = await setup()
  expect(await enrollTeam(examId, ["1", "2"], { notes: "x" })).toEqual({
    ok: false,
    code: "MISSING_ANSWER",
    labels: ["Tytuł projektu"],
  })
  expect(await db.enrollment.count({ where: { examId } })).toBe(0)

  const result = await enrollTeam(examId, ["1", "2"], { title: " Robot ", notes: "" })
  expect(result).toMatchObject({
    ok: true,
    ticket: { answers: [{ label: "Tytuł projektu", value: "Robot" }] },
  })
  expect([await answersOf("1"), await answersOf("2")]).toEqual([
    { title: "Robot" },
    { title: "Robot" },
  ])
})

test("na tablicy: dołączający przejmuje odpowiedzi zespołu, przeniesiony zespół zachowuje swoje", async () => {
  const { examId, ownerId, answersOf } = await setup()
  const first = await enrollTeam(examId, ["1"], { title: "Robot" })
  if (!first.ok) throw new Error(first.code)
  const slots = await db.slot.findMany({ where: { examId }, orderBy: { startsAt: "asc" } })
  const free = slots.find((s) => s.id !== first.slotId)!

  await runBoardCommand(examId, ownerId, {
    kind: "move",
    studentNumber: "2",
    toSlotId: first.slotId,
  })
  expect(await answersOf("2")).toEqual({ title: "Robot" })

  await runBoardCommand(examId, ownerId, { kind: "swapSlots", a: first.slotId, b: free.id })
  expect([await answersOf("1"), await answersOf("2")]).toEqual([
    { title: "Robot" },
    { title: "Robot" },
  ])

  expect(
    await setSlotAnswers(examId, ownerId, free.id, { title: "Dron", notes: "spóźni się" }),
  ).toEqual({ ok: true })
  expect(await answersOf("1")).toEqual({ title: "Dron", notes: "spóźni się" })
  expect(await answersOf("2")).toEqual({ title: "Dron", notes: "spóźni się" })
})

test("Cofnij po wypisaniu osoby przywraca jej odpowiedzi", async () => {
  const { examId, ownerId, answersOf } = await setup()
  const enrolled = await enrollTeam(examId, ["1"], { title: "Robot", notes: "x" })
  if (!enrolled.ok) throw new Error(enrolled.code)

  const removed = await runBoardCommand(examId, ownerId, {
    kind: "move",
    studentNumber: "1",
    toSlotId: null,
  })
  if (!removed.ok) throw new Error(removed.code)
  expect(await answersOf("1")).toBeUndefined()

  expect(await runBoardCommand(examId, ownerId, removed.inverse)).toMatchObject({ ok: true })
  expect(await answersOf("1")).toEqual({ title: "Robot", notes: "x" })
})

test("Cofnij po wypisaniu całego zespołu (osoba po osobie) przywraca odpowiedzi", async () => {
  const { examId, ownerId, answersOf } = await setup()
  const enrolled = await enrollTeam(examId, ["1", "2"], { title: "Robot" })
  if (!enrolled.ok) throw new Error(enrolled.code)

  const inverses = []
  for (const studentNumber of ["1", "2"]) {
    const removed = await runBoardCommand(examId, ownerId, {
      kind: "move",
      studentNumber,
      toSlotId: null,
    })
    if (!removed.ok) throw new Error(removed.code)
    inverses.push(removed.inverse)
  }
  for (const inverse of inverses.toReversed()) await runBoardCommand(examId, ownerId, inverse)

  expect([await answersOf("1"), await answersOf("2")]).toEqual([
    { title: "Robot" },
    { title: "Robot" },
  ])
  const slots = await db.enrollment.findMany({ where: { examId }, select: { slotId: true } })
  expect(slots).toEqual([{ slotId: enrolled.slotId }, { slotId: enrolled.slotId }])
})
