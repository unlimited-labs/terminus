import { expect, test } from "vitest"

import { getOwnedExam, withExamLock } from "@/server/exam-lock.server"

import { createExam } from "./fixtures"

test("withExamLock z właścicielem: własne zaliczenie działa, cudze wygląda jak nieistniejące", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })

  expect(await withExamLock(examId, teacherId, async () => "ok")).toBe("ok")
  expect(await withExamLock(examId, other.teacherId, async () => "ok")).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
  expect(await withExamLock(examId, null, async () => "ok")).toBe("ok")
})

test("getOwnedExam: własne zaliczenie zwraca, cudze i nieistniejące to null", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })
  expect(await getOwnedExam(examId, teacherId)).toMatchObject({ id: examId })
  expect(await getOwnedExam(examId, other.teacherId)).toBeNull()
  expect(await getOwnedExam("00000000-0000-4000-8000-000000000000", teacherId)).toBeNull()
})
