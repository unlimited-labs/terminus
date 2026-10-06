import { z } from "zod"

import { tooLong } from "../messages.pl.ts"
export const examIdSchema = z.object({ examId: z.uuid() })

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę.")

export const examFieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Podaj nazwę pola.").max(60, tooLong(60)),
  required: z.boolean(),
})

export const answersSchema = z.record(z.string(), z.string().max(500, tooLong(500)))

export const slotMinutes = z
  .number({ error: "Podaj liczbę minut." })
  .int("Podaj pełne minuty.")
  .min(1, "Slot musi mieć co najmniej 1 minutę.")
  .max(480, "Slot może mieć najwyżej 480 minut.")

export const examSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę zaliczenia.").max(200, tooLong(200)),
  description: z.string().trim().max(2000, tooLong(2000)),
  defaultSlotMinutes: slotMinutes,
  maxTeamSize: z
    .number({ error: "Podaj liczbę osób." })
    .int("Podaj liczbę całkowitą.")
    .min(1, "Zespół ma co najmniej 1 osobę.")
    .max(20, "Zespół może mieć najwyżej 20 osób."),
  fields: z.array(examFieldSchema).max(5, "Najwyżej 5 dodatkowych pól."),
  opensDate: z.union([z.literal(""), z.iso.date("Podaj datę.")]),
  opensTime: z.union([z.literal(""), hhmm]),
})

export const examFormSchema = examSchema.refine((v) => !v.opensDate === !v.opensTime, {
  message: "Podaj datę i godzinę startu albo zostaw oba pola puste.",
  path: ["opensTime"],
})

export const deleteExamSchema = examIdSchema.extend({ confirmName: z.string() })

export const duplicateExamSchema = examIdSchema.extend({ copyRosters: z.boolean() })
