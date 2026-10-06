import { z } from "zod"

import { examIdSchema, hhmm, slotMinutes } from "./exam.ts"

const date = z.iso.date("Podaj datę.")

export const windowSchema = examIdSchema.extend({
  rosterId: z.uuid("Wybierz listę."),
  date,
  from: hhmm,
  to: hhmm,
  minutes: slotMinutes,
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
