import { tz } from "@date-fns/tz"
import { format } from "date-fns"

const warsaw = tz("Europe/Warsaw")

/** Dzień w strefie Europe/Warsaw jako "RRRR-MM-DD". */
export function warsawDay(date: Date): string {
  return format(date, "yyyy-MM-dd", { in: warsaw })
}

/** Godzina w strefie Europe/Warsaw jako "GG:MM". */
export function warsawTime(date: Date): string {
  return format(date, "HH:mm", { in: warsaw })
}
