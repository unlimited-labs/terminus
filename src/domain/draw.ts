import { warsawDay } from "./time.ts"

export type EnrollmentData = {
  maxTeamSize: number
  /** Start zapisów; `null` = otwarte od razu. */
  opensAt?: Date | null
  entries: { studentNumber: string; rosterId: string }[]
  slots: { id: string; rosterId: string; startsAt: Date }[]
  enrollments: { studentNumber: string; slotId: string }[]
}

export type EnrollmentPlan =
  | { ok: true; slotId: string }
  | { ok: false; code: "NO_INPUT" | "NO_FREE_SLOTS" }
  | { ok: false; code: "TEAM_TOO_LARGE"; maxTeamSize: number }
  | { ok: false; code: "NOT_OPEN_YET"; opensAt: Date }
  | {
      ok: false
      code: "DUPLICATE_NUMBER" | "NOT_ON_ROSTER" | "DIFFERENT_ROSTER"
      studentNumbers: string[]
    }
  | { ok: false; code: "ALREADY_ENROLLED"; enrolled: { studentNumber: string; startsAt: Date }[] }

/** `randomInt(max)` zwraca liczbę całkowitą z [0, max). */
export type RandomInt = (max: number) => number

/**
 * Sprawdza zapis zespołu i losuje slot: najpierw dzień (z równą szansą), potem slot w tym dniu.
 * Pula to wolne sloty listy zespołu, które zaczynają się po `now`.
 */
export function planEnrollment(
  data: EnrollmentData,
  studentNumbers: string[],
  now: Date,
  randomInt: RandomInt,
): EnrollmentPlan {
  if (data.opensAt && data.opensAt > now)
    return { ok: false, code: "NOT_OPEN_YET", opensAt: data.opensAt }
  if (studentNumbers.length === 0) return { ok: false, code: "NO_INPUT" }
  if (studentNumbers.length > data.maxTeamSize) {
    return { ok: false, code: "TEAM_TOO_LARGE", maxTeamSize: data.maxTeamSize }
  }

  const duplicates = studentNumbers.filter((n, i) => studentNumbers.indexOf(n) !== i)
  if (duplicates.length > 0) {
    return { ok: false, code: "DUPLICATE_NUMBER", studentNumbers: [...new Set(duplicates)] }
  }

  const rosterOf = new Map(data.entries.map((e) => [e.studentNumber, e.rosterId]))
  const missing = studentNumbers.filter((n) => !rosterOf.has(n))
  if (missing.length > 0) return { ok: false, code: "NOT_ON_ROSTER", studentNumbers: missing }

  const slotById = new Map(data.slots.map((s) => [s.id, s]))
  const slotOf = new Map(data.enrollments.map((e) => [e.studentNumber, e.slotId]))
  const enrolled = studentNumbers
    .filter((n) => slotOf.has(n))
    .map((n) => ({ studentNumber: n, startsAt: slotById.get(slotOf.get(n)!)!.startsAt }))
  if (enrolled.length > 0) return { ok: false, code: "ALREADY_ENROLLED", enrolled }

  const rosterId = rosterOf.get(studentNumbers[0]!)!
  const foreign = studentNumbers.filter((n) => rosterOf.get(n) !== rosterId)
  if (foreign.length > 0) return { ok: false, code: "DIFFERENT_ROSTER", studentNumbers: foreign }

  const taken = new Set(data.enrollments.map((e) => e.slotId))
  const byDay = Map.groupBy(
    data.slots
      .filter((s) => s.rosterId === rosterId && !taken.has(s.id) && s.startsAt > now)
      .toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    (s) => warsawDay(s.startsAt),
  )
  const days = [...byDay.values()]
  if (days.length === 0) return { ok: false, code: "NO_FREE_SLOTS" }
  const day = days[randomInt(days.length)]!
  return { ok: true, slotId: day[randomInt(day.length)]!.id }
}
