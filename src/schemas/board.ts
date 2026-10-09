import { z } from "zod"

import { answersSchema, examIdSchema } from "./exam.ts"
import { personName, studentNumber } from "./roster.ts"

export const boardCommandSchema = z.discriminatedUnion("kind", [
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
  z.object({ kind: z.literal("unenrollTeam"), slotId: z.uuid() }),
  z.object({
    kind: z.literal("enrollTeam"),
    slotId: z.uuid(),
    studentNumbers: z.array(studentNumber).min(1),
    answers: answersSchema.optional(),
  }),
  z.object({ kind: z.literal("setAnswers"), slotId: z.uuid(), answers: answersSchema }),
])

export const boardInputSchema = examIdSchema.extend({ command: boardCommandSchema })
