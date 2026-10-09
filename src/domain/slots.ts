import { warsawDateTime } from "./time.ts"

export type Interval = { startsAt: Date; endsAt: Date }

export type WindowInput = { date: string; from: string; to: string; minutes: number }

export type WindowCut =
  | { ok: true; slots: Interval[]; unusedMinutes: number }
  | { ok: false; code: "WINDOW_END_BEFORE_START" | "WINDOW_TOO_SHORT" }

const MINUTE = 60_000

/** Tnie okno (jeden dzień, czas polski) na sloty równej długości; reszta z dzielenia przepada. */
export function cutWindow({ date, from, to, minutes }: WindowInput): WindowCut {
  const start = warsawDateTime(date, from).getTime()
  const end = warsawDateTime(date, to).getTime()
  if (end <= start) return { ok: false, code: "WINDOW_END_BEFORE_START" }
  const count = Math.floor((end - start) / (minutes * MINUTE))
  if (count === 0) return { ok: false, code: "WINDOW_TOO_SHORT" }
  const slots = Array.from({ length: count }, (_, i) => ({
    startsAt: new Date(start + i * minutes * MINUTE),
    endsAt: new Date(start + (i + 1) * minutes * MINUTE),
  }))
  return { ok: true, slots, unusedMinutes: (end - start) / MINUTE - count * minutes }
}

/** Pierwszy istniejący slot nachodzący na któryś z nowych (stykanie się dozwolone). */
export function findOverlap<T extends Interval & { id: string }>(
  added: Interval[],
  existing: T[],
  ignoreId?: string,
): T | undefined {
  return existing.find(
    (e) => e.id !== ignoreId && added.some((a) => a.startsAt < e.endsAt && e.startsAt < a.endsAt),
  )
}
