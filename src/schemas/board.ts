import { z } from "zod"

import { examIdSchema } from "./exam.ts"
import { studentNumber } from "./roster.ts"

const personName = z.string().trim().min(1).max(100)

const boardCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), studentNumber, toSlotId: z.uuid().nullable() }),
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
