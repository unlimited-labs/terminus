import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import type { Result } from "../messages.pl.ts"
import { buildExportCsv, exportFileName } from "../domain/csv.ts"
import {
  deleteExamSchema,
  duplicateExamSchema,
  examFormSchema,
  examIdSchema,
} from "../schemas/exam.ts"

import { db } from "./db.server.ts"
import { copyExam, examRecord, updateExamSettings } from "./exam-ops.server.ts"
import { getOwnedExam, withExamLock } from "./exam-lock.server.ts"
import { loadExam } from "./exam-state.server.ts"
import { requireUser } from "./session.ts"

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
    (await getOwnedExam(data.examId, context.user.id)) ? loadExam(data.examId) : null,
  )

export const examQuery = (examId: string) =>
  queryOptions({ queryKey: ["exam", examId], queryFn: () => getExam({ data: { examId } }) })

/** Co odświeżyć po zmianie zaliczenia: ono samo i lista zaliczeń (nazwa, liczniki). */
export const examKeys = (examId: string) => [examQuery(examId).queryKey, examsQuery().queryKey]

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examFormSchema)
  .handler(async ({ data, context }): Promise<Result<{ examId: string }>> => {
    const exam = await db.exam.create({ data: { ...examRecord(data), ownerId: context.user.id } })
    return { ok: true, examId: exam.id }
  })

export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examFormSchema.and(examIdSchema))
  .handler(async ({ data: { examId, ...data }, context }): Promise<Result> => {
    return updateExamSettings(examId, context.user.id, data)
  })

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(deleteExamSchema)
  .handler(async ({ data, context }): Promise<Result> => {
    return withExamLock(data.examId, context.user.id, async (tx): Promise<Result> => {
      const exam = await tx.exam.findUniqueOrThrow({ where: { id: data.examId } })
      if (exam.name !== data.confirmName.trim()) return { ok: false, code: "NAME_MISMATCH" }
      await tx.exam.delete({ where: { id: data.examId } })
      return { ok: true }
    })
  })

export const duplicateExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(duplicateExamSchema)
  .handler(async ({ data, context }): Promise<Result<{ examId: string }>> => {
    return copyExam(data.examId, context.user.id, data.copyRosters)
  })

export const exportExamCsv = createServerFn()
  .middleware([requireUser])
  .validator(examIdSchema)
  .handler(async ({ data, context }): Promise<Result<{ fileName: string; csv: string }>> => {
    if (!(await getOwnedExam(data.examId, context.user.id))) return { ok: false, code: "NOT_FOUND" }
    const exam = (await loadExam(data.examId))!
    const rosterName = new Map(exam.rosters.map((r) => [r.id, r.name]))
    const people = exam.people.map((p) => ({ ...p, rosterName: rosterName.get(p.rosterId) ?? "" }))
    return {
      ok: true,
      fileName: exportFileName(exam.name, new Date()),
      csv: buildExportCsv(exam.slots, people, exam.fields),
    }
  })
