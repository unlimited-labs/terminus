import { z } from "zod"

import { ASSIGNMENT_MODES } from "../domain/draw.ts"
import { EXAM_FIELDS_MAX, SLOT_MINUTES_MAX, TEAM_SIZE_MAX } from "../domain/limits.ts"
import { tooLong } from "../messages.pl.ts"
import { email } from "./auth.ts"
export const examIdSchema = z.object({ examId: z.uuid() })

export const hhmm = z.iso.time({ precision: -1, error: "Podaj godzinę." })

export const isoDate = z.iso.date("Podaj datę.")

const examFieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Podaj nazwę pola.").max(60, tooLong(60)),
  required: z.boolean(),
})

export const answersSchema = z.record(z.string(), z.string().max(500, tooLong(500)))

export const slotMinutes = z
  .number({ error: "Podaj liczbę minut." })
  .int("Podaj pełne minuty.")
  .min(1, "Slot musi mieć co najmniej 1 minutę.")
  .max(SLOT_MINUTES_MAX, `Slot może mieć najwyżej ${SLOT_MINUTES_MAX} minut.`)

export const assignmentMode = z.enum(ASSIGNMENT_MODES)

export const examSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę zaliczenia.").max(200, tooLong(200)),
  description: z.string().trim().max(2000, tooLong(2000)),
  defaultSlotMinutes: slotMinutes,
  maxTeamSize: z
    .number({ error: "Podaj liczbę osób." })
    .int("Podaj liczbę całkowitą.")
    .min(1, "Zespół ma co najmniej 1 osobę.")
    .max(TEAM_SIZE_MAX, `Zespół może mieć najwyżej ${TEAM_SIZE_MAX} osób.`),
  assignmentMode,
  requireEmailLogin: z.boolean(),
  showSlotTimes: z.boolean(),
  fields: z
    .array(examFieldSchema)
    .max(EXAM_FIELDS_MAX, `Najwyżej ${EXAM_FIELDS_MAX} dodatkowych pól.`),
  opensDate: z.union([z.literal(""), isoDate]),
  opensTime: z.union([z.literal(""), hhmm]),
})

export const examFormSchema = examSchema.refine((v) => !v.opensDate === !v.opensTime, {
  message: "Podaj datę i godzinę startu albo zostaw oba pola puste.",
  path: ["opensTime"],
})

export const deleteExamSchema = examIdSchema.extend({ confirmName: z.string().trim() })

export const duplicateExamSchema = examIdSchema.extend({ copyRosters: z.boolean() })

export const addTeacherSchema = examIdSchema.extend({ email })

export const removeTeacherSchema = examIdSchema.extend({ teacherId: z.string().min(1) })
