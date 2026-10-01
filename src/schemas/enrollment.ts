import { z } from "zod"

import { answersSchema, examIdSchema } from "./exam.ts"
import { studentNumber } from "./roster.ts"

export const enrollmentSchema = examIdSchema.extend({
  studentNumbers: z.array(studentNumber).min(1, "Wpisz numer indeksu.").max(20),
  answers: answersSchema,
})
