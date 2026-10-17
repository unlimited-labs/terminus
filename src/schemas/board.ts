import { z } from "zod"

import { GRADES } from "../domain/board.ts"
import { tooLong } from "../messages.pl.ts"
import { answersSchema, examIdSchema } from "./exam.ts"
import { personName, studentNumber } from "./roster.ts"

// Bez trim: pusty komentarz zamienia na null domena (setGrades), w kliencie i na serwerze tak samo.
const gradeEntry = z.object({
  grade: z.enum(GRADES).nullable(),
  comment: z.string().max(500, tooLong(500)).nullable(),
})
const gradesSchema = z.record(studentNumber, gradeEntry)

export const boardCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    studentNumber,
    toSlotId: z.uuid().nullable(),
    answers: answersSchema.optional(),
    grade: gradeEntry.optional(),
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
    grades: gradesSchema.optional(),
  }),
  z.object({ kind: z.literal("setAnswers"), slotId: z.uuid(), answers: answersSchema }),
  z.object({ kind: z.literal("setGrades"), grades: gradesSchema }),
])

export const boardInputSchema = examIdSchema.extend({ command: boardCommandSchema })
