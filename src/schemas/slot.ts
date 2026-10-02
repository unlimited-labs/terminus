import { z } from "zod"

import { examIdSchema, hhmm } from "./exam.ts"

const date = z.iso.date("Podaj datę.")

export const windowSchema = examIdSchema.extend({
  rosterId: z.uuid("Wybierz listę."),
  date,
  from: hhmm,
  to: hhmm,
  minutes: z
    .number({ error: "Podaj liczbę minut." })
    .int("Podaj pełne minuty.")
    .min(1, "Slot musi mieć co najmniej 1 minutę.")
    .max(480, "Slot może mieć najwyżej 480 minut."),
})

export const updateSlotSchema = examIdSchema.extend({
  slotId: z.uuid(),
  rosterId: z.uuid(),
  date,
  from: hhmm,
  to: hhmm,
})

export const slotRefSchema = examIdSchema.extend({ slotId: z.uuid() })

export const dayRefSchema = examIdSchema.extend({ day: date })
