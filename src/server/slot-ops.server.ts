import type { z } from "zod"

import { cutWindow, findOverlap, warsawDateTime, type Interval } from "../domain/slots.ts"
import { warsawDay } from "../domain/time.ts"
import type { Result } from "../messages.pl.ts"
import type { updateSlotSchema, windowSchema } from "../schemas/slot.ts"

import { withExamLock, type Tx } from "./exam-lock.server.ts"

async function overlapError(tx: Tx, examId: string, added: Interval[], ignoreId?: string) {
  const existing = await tx.slot.findMany({ where: { examId } })
  const hit = findOverlap(added, existing, ignoreId)
  return hit
    ? ({ ok: false, code: "SLOT_OVERLAP", startsAt: hit.startsAt, endsAt: hit.endsAt } as const)
    : null
}

export async function addWindow(
  examId: string,
  userId: string,
  window: Omit<z.infer<typeof windowSchema>, "examId">,
): Promise<Result<{ count: number }>> {
  const { rosterId } = window
  return withExamLock(examId, userId, async (tx): Promise<Result<{ count: number }>> => {
    if (!(await tx.roster.findFirst({ where: { id: rosterId, examId } }))) {
      return { ok: false, code: "ROSTER_REQUIRED" }
    }
    const cut = cutWindow(window)
    if (!cut.ok) return cut
    const overlap = await overlapError(tx, examId, cut.slots)
    if (overlap) return overlap
    await tx.slot.createMany({ data: cut.slots.map((s) => ({ ...s, examId, rosterId })) })
    return { ok: true, count: cut.slots.length }
  })
}

export async function editSlot(
  examId: string,
  userId: string,
  { slotId, rosterId, date, from, to }: Omit<z.infer<typeof updateSlotSchema>, "examId">,
): Promise<Result> {
  return withExamLock(examId, userId, async (tx): Promise<Result> => {
    const [slot, roster] = await Promise.all([
      tx.slot.findFirst({ where: { id: slotId, examId } }),
      tx.roster.findFirst({ where: { id: rosterId, examId } }),
    ])
    if (!slot || !roster) return { ok: false, code: "NOT_FOUND" }
    const interval = { startsAt: warsawDateTime(date, from), endsAt: warsawDateTime(date, to) }
    if (interval.endsAt <= interval.startsAt) return { ok: false, code: "WINDOW_END_BEFORE_START" }
    const overlap = await overlapError(tx, examId, [interval], slotId)
    if (overlap) return overlap
    await tx.slot.update({ where: { id: slotId }, data: { ...interval, rosterId } })
    return { ok: true }
  })
}

export async function removeSlot(examId: string, userId: string, slotId: string): Promise<Result> {
  return withExamLock(examId, userId, async (tx): Promise<Result> => {
    const slot = await tx.slot.findFirst({
      where: { id: slotId, examId },
      select: { _count: { select: { enrollments: true } } },
    })
    if (!slot) return { ok: false, code: "NOT_FOUND" }
    if (slot._count.enrollments > 0) return { ok: false, code: "SLOT_HAS_ENROLLMENTS" }
    await tx.slot.delete({ where: { id: slotId } })
    return { ok: true }
  })
}

export async function removeFreeSlotsOfDay(
  examId: string,
  userId: string,
  day: string,
): Promise<Result<{ deleted: number; skipped: number }>> {
  return withExamLock(examId, userId, async (tx) => {
    const slots = await tx.slot.findMany({
      where: { examId },
      select: { id: true, startsAt: true, _count: { select: { enrollments: true } } },
    })
    const ofDay = slots.filter((s) => warsawDay(s.startsAt) === day)
    const free = ofDay.filter((s) => s._count.enrollments === 0).map((s) => s.id)
    await tx.slot.deleteMany({ where: { id: { in: free } } })
    return { ok: true as const, deleted: free.length, skipped: ofDay.length - free.length }
  })
}
