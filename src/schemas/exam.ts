import { z } from "zod"

export const examIdSchema = z.object({ examId: z.uuid() })

export const examSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę zaliczenia.").max(200),
  description: z.string().trim().max(2000),
  defaultSlotMinutes: z
    .number({ error: "Podaj liczbę minut." })
    .int("Podaj pełne minuty.")
    .min(1, "Slot musi mieć co najmniej 1 minutę.")
    .max(480, "Slot może mieć najwyżej 480 minut."),
  maxTeamSize: z
    .number({ error: "Podaj liczbę osób." })
    .int("Podaj liczbę całkowitą.")
    .min(1, "Zespół ma co najmniej 1 osobę.")
    .max(20, "Zespół może mieć najwyżej 20 osób."),
})

export const deleteExamSchema = examIdSchema.extend({ confirmName: z.string() })
