import { createServerFn } from "@tanstack/react-start"

import { dayRefSchema, slotRefSchema, updateSlotSchema, windowSchema } from "../schemas/slot.ts"

import { requireUser } from "./session.ts"
import { addWindow, editSlot, removeFreeSlotsOfDay, removeSlot } from "./slot-ops.server.ts"

export const addSlotWindow = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(windowSchema)
  .handler(({ data, context }) => addWindow(data.examId, context.user.id, data))

export const updateSlot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(updateSlotSchema)
  .handler(({ data, context }) => editSlot(data.examId, context.user.id, data))

export const deleteSlot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(slotRefSchema)
  .handler(({ data, context }) => removeSlot(data.examId, context.user.id, data.slotId))

export const deleteFreeSlotsOfDay = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(dayRefSchema)
  .handler(({ data, context }) => removeFreeSlotsOfDay(data.examId, context.user.id, data.day))
