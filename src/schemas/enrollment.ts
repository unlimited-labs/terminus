import { z } from "zod"

import { TEAM_SIZE_MAX } from "../domain/limits.ts"
import { errorMessage } from "../messages.pl.ts"
import { answersSchema, assignmentMode, examIdSchema } from "./exam.ts"
import { studentNumber } from "./roster.ts"

export const enrollmentFormSchema = examIdSchema.extend({
  studentNumbers: z
    .array(studentNumber)
    .min(1, errorMessage({ code: "NO_INPUT" }))
    .max(TEAM_SIZE_MAX, `Najwyżej ${TEAM_SIZE_MAX} osób.`),
  answers: answersSchema,
})

export const enrollmentSchema = enrollmentFormSchema.extend({
  assignmentMode,
  slotId: z.uuid().optional(),
})
