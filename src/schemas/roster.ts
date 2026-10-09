import { z } from "zod"

import { PERSON_NAME_MAX, ROSTER_NAME_MAX, STUDENT_NUMBER_MAX } from "../domain/limits.ts"
import { tooLong } from "../messages.pl.ts"
import { examIdSchema } from "./exam.ts"

export const studentNumber = z
  .string()
  .trim()
  .regex(/^\d+$/, "Numer indeksu to same cyfry.")
  .max(STUDENT_NUMBER_MAX, "Za długi numer indeksu.")

export const personName = (label: string) =>
  z.string().trim().min(1, `Podaj ${label}.`).max(PERSON_NAME_MAX, tooLong(PERSON_NAME_MAX))

export const rosterImportSchema = examIdSchema.extend({
  rosterName: z
    .string()
    .trim()
    .min(1, "Podaj nazwę listy.")
    .max(ROSTER_NAME_MAX, tooLong(ROSTER_NAME_MAX)),
  csv: z.string().max(2_000_000, "Plik jest za duży."),
})

export const rosterApplySchema = rosterImportSchema.extend({
  withdrawnEnrolled: z.array(studentNumber).max(10_000),
})

export const addEntrySchema = examIdSchema.extend({
  rosterId: z.union([z.uuid(), z.literal("")]),
  studentNumber,
  firstName: personName("imię"),
  lastName: personName("nazwisko"),
})

export const entryRefSchema = examIdSchema.extend({ studentNumber })

export const rosterRefSchema = examIdSchema.extend({ rosterId: z.uuid() })
