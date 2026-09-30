import { createServerFn } from "@tanstack/react-start"

import { cutWindow, findOverlap, warsawDateTime, type Interval } from "../domain/slots.ts"
import { warsawDay } from "../domain/time.ts"
import type { Result } from "../messages.pl.ts"
import { dayRefSchema, slotRefSchema, updateSlotSchema, windowSchema } from "../schemas/slot.ts"

import { withExamLock, type Tx } from "./exam-lock.ts"
import { requireUser } from "./session.ts"

async function overlapError(tx: Tx, examId: string, added: Interval[], ignoreId?: string) {
  const existing = await tx.slot.findMany({ where: { examId } })
  const hit = findOverlap(added, existing, ignoreId)
  return hit
    ? ({ ok: false, code: "SLOT_OVERLAP", startsAt: hit.startsAt, endsAt: hit.endsAt } as const)
    : null
}

export const addSlotWindow = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(windowSchema)
  .handler(async ({ data, context }): Promise<Result<{ count: number }>> => {
    const { examId, rosterId } = data
    const result = await withExamLock(
      examId,
      context.user.id,
      async (tx): Promise<Result<{ count: number }>> => {
        if (!(await tx.roster.findFirst({ where: { id: rosterId, examId } }))) {
          return { ok: false, code: "ROSTER_REQUIRED" }
        }
        const cut = cutWindow(data)
        if (!cut.ok) return cut
        const overlap = await overlapError(tx, examId, cut.slots)
        if (overlap) return overlap
        await tx.slot.createMany({ data: cut.slots.map((s) => ({ ...s, examId, rosterId })) })
        return { ok: true, count: cut.slots.length }
      },
    )
    return result ?? { ok: false, code: "NOT_FOUND" }
  })

export const updateSlot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(updateSlotSchema)
  .handler(async ({ data, context }): Promise<Result> => {
    const { examId, slotId, rosterId } = data
    const result = await withExamLock(examId, context.user.id, async (tx): Promise<Result> => {
      const [slot, roster] = await Promise.all([
        tx.slot.findFirst({ where: { id: slotId, examId } }),
        tx.roster.findFirst({ where: { id: rosterId, examId } }),
      ])
      if (!slot || !roster) return { ok: false, code: "NOT_FOUND" }
      const interval = {
        startsAt: warsawDateTime(data.date, data.from),
        endsAt: warsawDateTime(data.date, data.to),
      }
      if (interval.endsAt <= interval.startsAt)
        return { ok: false, code: "WINDOW_END_BEFORE_START" }
      const overlap = await overlapError(tx, examId, [interval], slotId)
      if (overlap) return overlap
      await tx.slot.update({ where: { id: slotId }, data: { ...interval, rosterId } })
      return { ok: true }
    })
    return result ?? { ok: false, code: "NOT_FOUND" }
  })

export const deleteSlot = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(slotRefSchema)
  .handler(async ({ data: { examId, slotId }, context }): Promise<Result> => {
    const result = await withExamLock(examId, context.user.id, async (tx): Promise<Result> => {
      if ((await tx.enrollment.count({ where: { slotId } })) > 0) {
        return { ok: false, code: "SLOT_HAS_ENROLLMENTS" }
      }
      await tx.slot.deleteMany({ where: { id: slotId, examId } })
      return { ok: true }
    })
    return result ?? { ok: false, code: "NOT_FOUND" }
  })

export const deleteFreeSlotsOfDay = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(dayRefSchema)
  .handler(
    async ({
      data: { examId, day },
      context,
    }): Promise<Result<{ deleted: number; skipped: number }>> => {
      const result = await withExamLock(examId, context.user.id, async (tx) => {
        const slots = await tx.slot.findMany({
          where: { examId },
          select: { id: true, startsAt: true, _count: { select: { enrollments: true } } },
        })
        const ofDay = slots.filter((s) => warsawDay(s.startsAt) === day)
        const free = ofDay.filter((s) => s._count.enrollments === 0).map((s) => s.id)
        await tx.slot.deleteMany({ where: { id: { in: free } } })
        return { ok: true as const, deleted: free.length, skipped: ofDay.length - free.length }
      })
      return result ?? { ok: false, code: "NOT_FOUND" }
    },
  )
