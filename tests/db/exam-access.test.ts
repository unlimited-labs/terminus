import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { getOwnedExam, withExamLock } from "@/server/exam-access.server"

import { createExam } from "./fixtures"

test("withExamLock dla prowadzącego: własne zaliczenie działa, cudze wygląda jak nieistniejące", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })

  expect(await withExamLock(examId, { teacher: teacherId }, async () => "ok")).toBe("ok")
  expect(await withExamLock(examId, { teacher: other.teacherId }, async () => "ok")).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
  expect(await withExamLock(examId, "public", async () => "ok")).toBe("ok")
})

test('withExamLock "blocked": tylko zaliczenie, którego wszyscy prowadzący są zablokowani', async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const notFound = { ok: false, code: "NOT_FOUND" }
  expect(await withExamLock(examId, "blocked", async () => "ok")).toEqual(notFound)
  await db.user.update({ where: { id: teacherId }, data: { banned: true } })
  expect(await withExamLock(examId, "blocked", async () => "ok")).toBe("ok")
})

test("getOwnedExam: własne zaliczenie zwraca, cudze i nieistniejące to null", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })
  expect(await getOwnedExam(examId, teacherId)).toMatchObject({ id: examId })
  expect(await getOwnedExam(examId, other.teacherId)).toBeNull()
  expect(await getOwnedExam("00000000-0000-4000-8000-000000000000", teacherId)).toBeNull()
})
