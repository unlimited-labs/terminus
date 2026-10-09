import { tz } from "@date-fns/tz"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

const warsaw = tz("Europe/Warsaw")

/** Dzień w strefie Europe/Warsaw jako "RRRR-MM-DD". */
export function warsawDay(date: Date): string {
  return format(date, "yyyy-MM-dd", { in: warsaw })
}

/** Godzina w strefie Europe/Warsaw jako "GG:MM". */
export function warsawTime(date: Date): string {
  return format(date, "HH:mm", { in: warsaw })
}

/** "wtorek 6 października, 9:00" w strefie Europe/Warsaw. */
export function formatDayTime(date: Date): string {
  return formatWarsaw(date, "EEEE d MMMM, H:mm")
}

/** Dowolny wzorzec date-fns po polsku w strefie Europe/Warsaw. */
export function formatWarsaw(date: Date, pattern: string): string {
  return format(date, pattern, { in: warsaw, locale: pl })
}

/** "7–10 paź", "30 wrz – 2 paź", z rokiem tylko spoza roku `now`. */
export function formatDateRange(first: Date, last: Date, now: Date): string {
  const thisYear = formatWarsaw(now, "yyyy")
  const label = (d: Date) =>
    formatWarsaw(d, formatWarsaw(d, "yyyy") === thisYear ? "d MMM" : "d MMM yyyy")
  if (warsawDay(first) === warsawDay(last)) return label(last)
  if (formatWarsaw(first, "yyyy-MM") === formatWarsaw(last, "yyyy-MM"))
    return `${formatWarsaw(first, "d")}–${label(last)}`
  return `${label(first)} – ${label(last)}`
}

/** "wt 6.10" w strefie Europe/Warsaw. */
export function formatDayShort(date: Date): string {
  return formatWarsaw(date, "EEEEEE d.MM")
}
