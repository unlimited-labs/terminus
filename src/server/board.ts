import { createServerFn } from "@tanstack/react-start"

import type { BoardCommand } from "../domain/board.ts"
import type { Result } from "../messages.pl.ts"
import { boardInputSchema, slotAnswersSchema } from "../schemas/board.ts"

import { runBoardCommand, setSlotAnswers } from "./board-ops.server.ts"
import { loadExam, type ExamDetail } from "./exam-state.server.ts"
import { requireUser } from "./session.ts"

/** Klucz poleceń tablicy: kolejka (scope) i wstrzymanie odświeżania w trakcie. */
export const boardMutationKey = (examId: string) => ["board", examId]

export const applyBoardCommand = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(boardInputSchema)
  .handler(
    async ({ data, context }): Promise<Result<{ inverse: BoardCommand; exam: ExamDetail }>> => {
      const result = await runBoardCommand(data.examId, context.user.id, data.command)
      if (!result.ok) return result
      return { ...result, exam: (await loadExam(data.examId))! }
    },
  )

export const updateSlotAnswers = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(slotAnswersSchema)
  .handler(({ data, context }): Promise<Result> =>
    setSlotAnswers(data.examId, context.user.id, data.slotId, data.answers),
  )
