import { TZDate, tz } from "@date-fns/tz"
import { format, isSameDay, isSameMonth, isSameYear } from "date-fns"
import { pl } from "date-fns/locale"

import type { Interval } from "./slots.ts"

const warsaw = tz("Europe/Warsaw")

/** Dzień w strefie Europe/Warsaw jako "RRRR-MM-DD". */
export function warsawDay(date: Date): string {
  return format(date, "yyyy-MM-dd", { in: warsaw })
}

/** Godzina w strefie Europe/Warsaw jako "GG:MM". */
export function warsawTime(date: Date): string {
  return format(date, "HH:mm", { in: warsaw })
}

/** Czas polski ("RRRR-MM-DD", "GG:MM") → chwila w UTC. */
export function warsawDateTime(date: string, time: string): Date {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number)
  const [h = 0, min = 0] = time.split(":").map(Number)
  return new Date(new TZDate(y, m - 1, d, h, min, "Europe/Warsaw").getTime())
}

/** "wtorek 6 października" w strefie Europe/Warsaw. */
export function formatDay(date: Date): string {
  return formatWarsaw(date, "EEEE d MMMM")
}

/** "wtorek 6 października, 9:00" w strefie Europe/Warsaw. */
export function formatDayTime(date: Date): string {
  return `${formatDay(date)}, ${formatWarsaw(date, "H:mm")}`
}

/** Numer slotu: ile slotów dnia `at` (Europe/Warsaw) zaczyna się nie później niż `at`. Zawsze z pełnej listy slotów zaliczenia. */
export function slotNumber(slots: { startsAt: Date }[], at: Date): number {
  const day = warsawDay(at)
  return slots.filter((s) => s.startsAt <= at && warsawDay(s.startsAt) === day).length
}

/** Numerowanie slotów: wszystkie sloty zaliczenia, gdy zamiast godzin widać numer slotu; `null` = godziny widoczne. */
export type SlotNumbering = { startsAt: Date }[] | null

export const slotNumbering = (exam: {
  showSlotTimes: boolean
  slots: { startsAt: Date }[]
}): SlotNumbering => (exam.showSlotTimes ? null : exam.slots)

/** Jak pokazać chwilę slotu w komunikacie (godzina albo numer slotu). */
export type SlotWhen = (at: Date) => string

/** Kiedy slot: "wtorek 6 października, 9:00" albo przy numerowaniu "wtorek 6 października, slot 3". */
export function formatSlotWhen(at: Date, numbering: SlotNumbering): string {
  return numbering ? `${formatDay(at)}, slot ${slotNumber(numbering, at)}` : formatDayTime(at)
}

/** "09:00–09:20" w strefie Europe/Warsaw. */
export function formatSlotTime({ startsAt, endsAt }: Interval): string {
  return `${warsawTime(startsAt)}–${warsawTime(endsAt)}`
}

/** Dowolny wzorzec date-fns po polsku w strefie Europe/Warsaw. */
export function formatWarsaw(date: Date, pattern: string): string {
  return format(date, pattern, { in: warsaw, locale: pl })
}

/** "7–10 paź", "30 wrz – 2 paź", z rokiem tylko spoza roku `now`. */
export function formatDateRange(first: Date, last: Date, now: Date): string {
  const label = (d: Date) =>
    formatWarsaw(d, isSameYear(d, now, { in: warsaw }) ? "d MMM" : "d MMM yyyy")
  if (isSameDay(first, last, { in: warsaw })) return label(last)
  if (isSameMonth(first, last, { in: warsaw })) return `${formatWarsaw(first, "d")}–${label(last)}`
  return `${label(first)} – ${label(last)}`
}

/** "wt 6.10" w strefie Europe/Warsaw. */
export function formatDayShort(date: Date): string {
  return formatWarsaw(date, "EEEEEE d.MM")
}
