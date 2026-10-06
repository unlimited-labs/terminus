import { z } from "zod"

import { tooLong } from "../messages.pl.ts"
import { answersSchema, examIdSchema } from "./exam.ts"
import { studentNumber } from "./roster.ts"

const personName = z.string().trim().min(1, "Podaj imię i nazwisko.").max(100, tooLong(100))

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
    firstName: personName,
    lastName: personName,
  }),
])

export const boardInputSchema = examIdSchema.extend({ command: boardCommandSchema })

export const slotAnswersSchema = examIdSchema.extend({ slotId: z.uuid(), answers: answersSchema })
