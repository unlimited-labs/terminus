import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { enrollTeam } from "@/server/enrollment.server"

import { createExam, inDays } from "./fixtures"

async function enrolledExam() {
  const fixture = await createExam({
    rosters: { g1: { students: ["1", "2"], slots: [inDays(1), inDays(2)] } },
  })
  const result = await enrollTeam(fixture.examId, ["1"])
  if (!result.ok) throw new Error(result.code)
  return { ...fixture, slotId: result.slotId }
}

test("slotu z zapisem nie da się usunąć", async () => {
  const { slotId } = await enrolledExam()
  await expect(db.slot.delete({ where: { id: slotId } })).rejects.toThrow(/Foreign key constraint/)
})

test("wpisu listy z zapisem nie da się usunąć", async () => {
  const { examId } = await enrolledExam()
  await expect(
    db.rosterEntry.delete({ where: { examId_studentNumber: { examId, studentNumber: "1" } } }),
  ).rejects.toThrow(/Foreign key constraint/)
  await db.rosterEntry.delete({ where: { examId_studentNumber: { examId, studentNumber: "2" } } })
})

test("listy z zapisem nie da się usunąć", async () => {
  const { rosterIds } = await enrolledExam()
  await expect(db.roster.delete({ where: { id: rosterIds.g1! } })).rejects.toThrow(
    /Foreign key constraint/,
  )
})

test("usunięcie zaliczenia kasuje listy, wpisy, sloty i zapisy", async () => {
  const { examId } = await enrolledExam()
  await db.exam.delete({ where: { id: examId } })
  const counts = await Promise.all([
    db.roster.count({ where: { examId } }),
    db.rosterEntry.count({ where: { examId } }),
    db.slot.count({ where: { examId } }),
    db.enrollment.count({ where: { examId } }),
  ])
  expect(counts).toEqual([0, 0, 0, 0])
})

test("indeks najwyżej raz na listach zaliczenia i raz w zapisach", async () => {
  const { examId, rosterIds, slotId } = await enrolledExam()
  await expect(
    db.rosterEntry.create({
      data: { examId, studentNumber: "1", rosterId: rosterIds.g1!, firstName: "X", lastName: "Y" },
    }),
  ).rejects.toThrow(/Unique constraint/)
  await expect(
    db.enrollment.create({ data: { examId, studentNumber: "1", slotId } }),
  ).rejects.toThrow(/Unique constraint/)
})
