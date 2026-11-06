// Osobno od csv.ts: klient potrzebuje nazw, a nie papaparse.
import { ROSTER_NAME_MAX } from "./limits.ts"
import { warsawDay } from "./time.ts"

/** `studenci_110-ITE-2S-027_g1_2026-09-30.csv` → `g1`; inaczej nazwa pliku bez rozszerzenia. */
export function suggestRosterName(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "")
  return (/_([^_]+)_\d{4}-\d{2}-\d{2}$/.exec(base)?.[1] ?? base).slice(0, ROSTER_NAME_MAX)
}

export function exportFileName(examName: string, now: Date): string {
  return `${examName.replace(/[\\/:*?"<>|]/g, "-")}_${warsawDay(now)}.csv`
}
