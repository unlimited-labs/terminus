import { randomUUID } from "node:crypto"

import { expect, test, vi } from "vitest"

import { runBoardCommand } from "@/server/board-ops.server"
import { db } from "@/server/db.server"
import { serveExamChanges } from "@/server/exam-access.server"
import { onExamChange } from "@/server/exam-changes.server"

import { createExam, inDays } from "./fixtures"
import { account } from "./sessions"

test("komenda tablicy emituje sygnał po zapisie; NO_CHANGE i NOT_FOUND nie", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
  })
  const [slot] = await db.slot.findMany({ where: { examId } })
  const listener = vi.fn<() => void>()
  onExamChange(examId, listener)
  const move = (teacher: string, toSlotId: string | null) =>
    runBoardCommand(examId, teacher, { kind: "move", studentNumber: "1", toSlotId })

  // Najpierw odmowy: po udanej komendzie okno łączenia jest otwarte i błędny sygnał by się ukrył.
  expect(await move(teacherId, null)).toMatchObject({ ok: false, code: "NO_CHANGE" })
  expect(await move(randomUUID(), slot!.id)).toMatchObject({ ok: false, code: "NOT_FOUND" })
  expect(listener).not.toHaveBeenCalled()

  expect(await move(teacherId, slot!.id)).toMatchObject({ ok: true })
  expect(listener).toHaveBeenCalledTimes(1)
})

/** Status odpowiedzi kanału zmian; strumień 200 od razu zamknięty, żeby nie wisiał. */
async function status(examId: string, headers = new Headers()) {
  const request = new Request(`http://localhost/api/exams/${examId}/changes`, { headers })
  const response = await serveExamChanges(request, examId)
  await response.body?.cancel()
  return response.status
}

test("kanał zmian: prowadzący i student przy otwartej bramce tak, obcy prowadzący i bramka logowania nie", async () => {
  const { examId } = await createExam({ rosters: {} })
  const owner = await account()
  const stranger = await account()
  await db.exam.update({ where: { id: examId }, data: { teachers: { connect: { id: owner.id } } } })

  expect(await status(examId)).toBe(200)
  expect(await status("nie-uuid")).toBe(404)

  await db.exam.update({ where: { id: examId }, data: { requireEmailLogin: true } })
  expect(await status(examId, owner.headers)).toBe(200)
  expect(await status(examId, stranger.headers)).toBe(403)
  expect(await status(examId)).toBe(403)
})
