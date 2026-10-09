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
