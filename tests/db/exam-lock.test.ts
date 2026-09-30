import { expect, test } from "vitest"

import { withExamLock } from "@/server/exam-lock"

import { createExam } from "./fixtures"

test("withExamLock z właścicielem: własne zaliczenie działa, cudze wygląda jak nieistniejące", async () => {
  const { examId, ownerId } = await createExam({ rosters: {} })
  const other = await createExam({ rosters: {} })

  expect(await withExamLock(examId, ownerId, async () => "ok")).toBe("ok")
  expect(await withExamLock(examId, other.ownerId, async () => "ok")).toBeNull()
  expect(await withExamLock(examId, null, async () => "ok")).toBe("ok")
})
