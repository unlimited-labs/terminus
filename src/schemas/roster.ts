import { z } from "zod"

import { examIdSchema } from "./exam.ts"

const studentNumber = z
  .string()
  .trim()
  .regex(/^\d+$/, "Numer indeksu to same cyfry.")
  .max(20, "Za długi numer indeksu.")

const personName = (label: string) => z.string().trim().min(1, `Podaj ${label}.`).max(100)

export const rosterImportSchema = examIdSchema.extend({
  rosterName: z.string().trim().min(1, "Podaj nazwę listy.").max(50),
  csv: z.string().max(2_000_000, "Plik jest za duży."),
})

export const addEntrySchema = examIdSchema.extend({
  rosterId: z.string(),
  studentNumber,
  firstName: personName("imię"),
  lastName: personName("nazwisko"),
})

export const entryRefSchema = examIdSchema.extend({ studentNumber })

export const rosterRefSchema = examIdSchema.extend({ rosterId: z.uuid() })
