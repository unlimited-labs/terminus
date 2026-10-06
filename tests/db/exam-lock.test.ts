import { expect, test } from "vitest"

import { getOwnedExam, withExamLock } from "@/server/exam-lock.server"

import { createExam } from "./fixtures"

test("withExamLock z właścicielem: własne zaliczenie działa, cudze wygląda jak nieistniejące", async () => {
  const { examId, ownerId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })

  expect(await withExamLock(examId, ownerId, async () => "ok")).toBe("ok")
  expect(await withExamLock(examId, other.ownerId, async () => "ok")).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
  expect(await withExamLock(examId, null, async () => "ok")).toBe("ok")
})

test("getOwnedExam: własne zaliczenie zwraca, cudze i nieistniejące to null", async () => {
  const { examId, ownerId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })
  expect(await getOwnedExam(examId, ownerId)).toMatchObject({ id: examId })
  expect(await getOwnedExam(examId, other.ownerId)).toBeNull()
  expect(await getOwnedExam("00000000-0000-4000-8000-000000000000", ownerId)).toBeNull()
})
