import { expect, test } from "vitest"

import { runBoardCommand, setSlotAnswers } from "@/server/board-ops.server"
import { db } from "@/server/db.server"

import { createExam, enroll, inDays } from "./fixtures"

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
  expect(await enroll(examId, ["1", "2"], { notes: "x" })).toEqual({
    ok: false,
    code: "MISSING_ANSWER",
    labels: ["Tytuł projektu"],
  })
  expect(await db.enrollment.count({ where: { examId } })).toBe(0)

  const result = await enroll(examId, ["1", "2"], { title: " Robot ", notes: "" })
  expect(result).toMatchObject({
    ok: true,
    ticket: { answers: [{ label: "Tytuł projektu", value: "Robot" }] },
  })
  expect([await answersOf("1"), await answersOf("2")]).toEqual([
    { title: "Robot" },
    { title: "Robot" },
  ])
})

test("na tablicy: dołączający dostaje w bazie odpowiedzi zespołu; poprawka odpowiedzi trafia do całego zespołu", async () => {
  const { examId, teacherId, answersOf } = await setup()
  const first = await enroll(examId, ["1"], { title: "Robot" })
  if (!first.ok) throw new Error(first.code)

  await runBoardCommand(examId, teacherId, {
    kind: "move",
    studentNumber: "2",
    toSlotId: first.slotId,
  })
  expect(await answersOf("2")).toEqual({ title: "Robot" })

  expect(
    await setSlotAnswers(examId, teacherId, first.slotId, { title: "Dron", notes: "spóźni się" }),
  ).toEqual({ ok: true })
  expect(await answersOf("1")).toEqual({ title: "Dron", notes: "spóźni się" })
  expect(await answersOf("2")).toEqual({ title: "Dron", notes: "spóźni się" })
})

test("Cofnij po wypisaniu całego zespołu (osoba po osobie) przywraca odpowiedzi", async () => {
  const { examId, teacherId, answersOf } = await setup()
  const enrolled = await enroll(examId, ["1", "2"], { title: "Robot" })
  if (!enrolled.ok) throw new Error(enrolled.code)

  const inverses = []
  for (const studentNumber of ["1", "2"]) {
    const removed = await runBoardCommand(examId, teacherId, {
      kind: "move",
      studentNumber,
      toSlotId: null,
    })
    if (!removed.ok) throw new Error(removed.code)
    inverses.push(removed.inverse)
  }
  for (const inverse of inverses.toReversed()) await runBoardCommand(examId, teacherId, inverse)

  expect([await answersOf("1"), await answersOf("2")]).toEqual([
    { title: "Robot" },
    { title: "Robot" },
  ])
  const slots = await db.enrollment.findMany({ where: { examId }, select: { slotId: true } })
  expect(slots).toEqual([{ slotId: enrolled.slotId }, { slotId: enrolled.slotId }])
})
