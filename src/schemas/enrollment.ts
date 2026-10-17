import { z } from "zod"

import { answersSchema, examIdSchema } from "./exam.ts"
import { studentNumber } from "./roster.ts"

export const enrollmentFormSchema = examIdSchema.extend({
  studentNumbers: z
    .array(studentNumber)
    .min(1, "Wpisz numer indeksu.")
    .max(20, "Najwyżej 20 osób."),
  answers: answersSchema,
})

export const enrollmentSchema = z.discriminatedUnion("assignmentMode", [
  enrollmentFormSchema.extend({ assignmentMode: z.literal("RANDOM") }),
  enrollmentFormSchema.extend({ assignmentMode: z.literal("MANUAL"), slotId: z.uuid().optional() }),
])
