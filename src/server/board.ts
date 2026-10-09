import { createServerFn } from "@tanstack/react-start"

import type { BoardCommand } from "../domain/board.ts"
import type { Result } from "../messages.pl.ts"
import { boardInputSchema } from "../schemas/board.ts"

import { runBoardCommand } from "./board-ops.server.ts"
import { loadExam, type ExamDetail } from "./exam-state.server.ts"
import { requireUser } from "./session.ts"

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
