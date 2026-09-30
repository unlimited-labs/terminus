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
  return format(date, "EEEE d MMMM, H:mm", { in: warsaw, locale: pl })
}

/** "wt 6.10" w strefie Europe/Warsaw. */
export function formatDayShort(date: Date): string {
  return format(date, "EEEEEE d.MM", { in: warsaw, locale: pl })
}
