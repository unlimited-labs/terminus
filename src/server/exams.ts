import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import type { Result } from "../messages.pl.ts"
import {
  addTeacherSchema,
  deleteExamSchema,
  duplicateExamSchema,
  examFormSchema,
  examIdSchema,
  removeTeacherSchema,
} from "../schemas/exam.ts"

import {
  addTeacher,
  copyExam,
  examCsv,
  examsOf,
  insertExam,
  readExam,
  removeExam,
  removeTeacher,
  updateExamSettings,
} from "./exam-ops.server.ts"
import { requireUser } from "./session.ts"

const listExams = createServerFn()
  .middleware([requireUser])
  .handler(({ context }) => examsOf(context.user.id))

export const examsQuery = () => queryOptions({ queryKey: ["exams"], queryFn: () => listExams() })

const getExam = createServerFn()
  .middleware([requireUser])
  .validator(examIdSchema)
  .handler(({ data, context }) => readExam(data.examId, context.user.id))

export const examQuery = (examId: string) =>
  queryOptions({ queryKey: ["exam", examId], queryFn: () => getExam({ data: { examId } }) })

/** Co odświeżyć po zmianie zaliczenia: ono samo i lista zaliczeń (nazwa, liczniki). */
export const examChangeKeys = (examId: string) => [
  examQuery(examId).queryKey,
  examsQuery().queryKey,
]

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examFormSchema)
  .handler(({ data, context }) => insertExam(context.user.id, data))

export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(examFormSchema.and(examIdSchema))
  .handler(async ({ data: { examId, ...data }, context }): Promise<Result> => {
    return updateExamSettings(examId, context.user.id, data)
  })

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(deleteExamSchema)
  .handler(({ data, context }) =>
    removeExam(data.examId, { teacher: context.user.id }, data.confirmName),
  )

export const duplicateExam = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(duplicateExamSchema)
  .handler(async ({ data, context }): Promise<Result<{ examId: string }>> => {
    return copyExam(data.examId, context.user.id, data.copyRosters)
  })

export const addExamTeacher = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(addTeacherSchema)
  .handler(({ data, context }) => addTeacher(data.examId, context.user.id, data.email))

export const removeExamTeacher = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(removeTeacherSchema)
  .handler(({ data, context }) => removeTeacher(data.examId, context.user.id, data.teacherId))

export const exportExamCsv = createServerFn()
  .middleware([requireUser])
  .validator(examIdSchema)
  .handler(({ data, context }) => examCsv(data.examId, context.user.id))
