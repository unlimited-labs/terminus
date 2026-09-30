import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import type { Result } from "../messages.pl.ts"
import { deleteExamSchema, examIdSchema, examSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"
import { withExamLock } from "./exam-lock.server.ts"
import { loadExam } from "./exam-state.server.ts"
import { requireUser } from "./session.ts"

/** Jedyna brama do zaliczenia prowadzącego: cudze zaliczenie = nie znaleziono. */
function getOwnedExam(userId: string, examId: string) {
  return db.exam.findFirst({ where: { id: examId, ownerId: userId } })
}

const listExams = createServerFn()
  .middleware([requireUser])
  .handler(({ context }) =>
    db.exam.findMany({
      where: { ownerId: context.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { enrollments: true } },
        rosters: { select: { _count: { select: { entries: true, slots: true } } } },
      },
    }),
  )

export const examsQuery = () => queryOptions({ queryKey: ["exams"], queryFn: () => listExams() })

const getExam = createServerFn()
  .middleware([requireUser])
  .validator(examIdSchema)
  .handler(async ({ data, context }) =>
    (await getOwnedExam(context.user.id, data.examId)) ? loadExam(data.examId) : null,
  )

export const examQuery = (examId: string) =>
  queryOptions({ queryKey: ["exam", examId], queryFn: () => getExam({ data: { examId } }) })

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examSchema)
  .handler(async ({ data, context }): Promise<Result<{ examId: string }>> => {
    const exam = await db.exam.create({ data: { ...data, ownerId: context.user.id } })
    return { ok: true, examId: exam.id }
  })

export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examSchema.extend(examIdSchema.shape))
  .handler(async ({ data: { examId, ...data }, context }): Promise<Result> => {
    const result = await withExamLock(examId, context.user.id, async (tx): Promise<Result> => {
      const teams = await tx.enrollment.groupBy({ by: ["slotId"], where: { examId }, _count: true })
      const tooBig = teams.filter((t) => t._count > data.maxTeamSize).map((t) => t.slotId)
      if (tooBig.length > 0) {
        const slots = await tx.slot.findMany({
          where: { id: { in: tooBig } },
          orderBy: { startsAt: "asc" },
          select: { startsAt: true },
        })
        return { ok: false, code: "TEAM_SIZE_BELOW_EXISTING", slots: slots.map((s) => s.startsAt) }
      }
      await tx.exam.update({ where: { id: examId }, data })
      return { ok: true }
    })
    return result ?? { ok: false, code: "NOT_FOUND" }
  })

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(deleteExamSchema)
  .handler(async ({ data, context }): Promise<Result> => {
    const result = await withExamLock(data.examId, context.user.id, async (tx): Promise<Result> => {
      const exam = await tx.exam.findUniqueOrThrow({ where: { id: data.examId } })
      if (exam.name !== data.confirmName.trim()) return { ok: false, code: "NAME_MISMATCH" }
      await tx.exam.delete({ where: { id: data.examId } })
      return { ok: true }
    })
    return result ?? { ok: false, code: "NOT_FOUND" }
  })
