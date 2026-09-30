import { z } from "zod"

import { examIdSchema } from "./exam.ts"

const date = z.iso.date("Podaj datę.")
const time = z.string().regex(/^\d{2}:\d{2}$/, "Podaj godzinę.")

export const windowSchema = examIdSchema.extend({
  rosterId: z.uuid("Wybierz listę."),
  date,
  from: time,
  to: time,
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
  from: time,
  to: time,
})

export const slotRefSchema = examIdSchema.extend({ slotId: z.uuid() })

export const dayRefSchema = examIdSchema.extend({ day: date })
