import { z } from "zod"

import { answersSchema, examIdSchema } from "./exam.ts"
import { personName, studentNumber } from "./roster.ts"

const boardCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    studentNumber,
    toSlotId: z.uuid().nullable(),
    answers: answersSchema.optional(),
  }),
  z.object({ kind: z.literal("swapPeople"), a: studentNumber, b: studentNumber }),
  z.object({ kind: z.literal("swapSlots"), a: z.uuid(), b: z.uuid() }),
  z.object({
    kind: z.literal("rename"),
    studentNumber,
    firstName: personName("imię"),
    lastName: personName("nazwisko"),
  }),
])

export const boardInputSchema = examIdSchema.extend({ command: boardCommandSchema })

export const slotAnswersSchema = examIdSchema.extend({ slotId: z.uuid(), answers: answersSchema })
