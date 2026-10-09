import { z } from "zod"

import { examIdSchema, hhmm, isoDate, slotMinutes } from "./exam.ts"

export const windowSchema = examIdSchema.extend({
  rosterId: z.uuid("Wybierz listę."),
  date: isoDate,
  from: hhmm,
  to: hhmm,
  minutes: slotMinutes,
})

export const updateSlotSchema = examIdSchema.extend({
  slotId: z.uuid(),
  rosterId: z.uuid(),
  date: isoDate,
  from: hhmm,
  to: hhmm,
})

export const slotRefSchema = examIdSchema.extend({ slotId: z.uuid() })

export const dayRefSchema = examIdSchema.extend({ day: isoDate })
