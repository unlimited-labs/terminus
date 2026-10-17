import { isEnrollmentOpen, isFreeSlot } from "./schedule.ts"
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
  | { ok: false; code: "SLOT_UNAVAILABLE" }
  | { ok: false; code: "SLOT_OTHER_ROSTER"; slotRosterId: string; teamRosterId: string }

export type AssignmentMode = "RANDOM" | "MANUAL"

/** `randomInt(max)` zwraca liczbę całkowitą z [0, max). */
export type RandomInt = (max: number) => number

type TeamCheck = { ok: true; rosterId: string } | Exclude<EnrollmentPlan, { ok: true }>

function checkTeam(data: EnrollmentData, studentNumbers: string[], now: Date): TeamCheck {
  if (data.opensAt && !isEnrollmentOpen(data.opensAt, now))
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
  return { ok: true, rosterId }
}

export function planEnrollment(
  data: EnrollmentData,
  studentNumbers: string[],
  now: Date,
  randomInt: RandomInt,
): EnrollmentPlan {
  const team = checkTeam(data, studentNumbers, now)
  if (!team.ok) return team

  const taken = new Set(data.enrollments.map((e) => e.slotId))
  const byDay = Map.groupBy(
    data.slots
      .filter((s) => s.rosterId === team.rosterId && isFreeSlot(s, taken.has(s.id), now))
      .toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    (s) => warsawDay(s.startsAt),
  )
  const days = [...byDay.values()]
  if (days.length === 0) return { ok: false, code: "NO_FREE_SLOTS" }
  const day = days[randomInt(days.length)]!
  return { ok: true, slotId: day[randomInt(day.length)]!.id }
}

const SLOT_UNAVAILABLE = { ok: false, code: "SLOT_UNAVAILABLE" } as const

export function planChoice(
  data: EnrollmentData,
  studentNumbers: string[],
  slotId: string,
  now: Date,
): EnrollmentPlan {
  const team = checkTeam(data, studentNumbers, now)
  if (!team.ok) return team

  const slot = data.slots.find((s) => s.id === slotId)
  if (!slot) return SLOT_UNAVAILABLE
  if (slot.rosterId !== team.rosterId) {
    return {
      ok: false,
      code: "SLOT_OTHER_ROSTER",
      slotRosterId: slot.rosterId,
      teamRosterId: team.rosterId,
    }
  }
  const taken = data.enrollments.some((e) => e.slotId === slotId)
  if (!isFreeSlot(slot, taken, now)) return SLOT_UNAVAILABLE
  return { ok: true, slotId }
}

export function planLookup(
  data: EnrollmentData,
  studentNumbers: string[],
  now: Date,
): EnrollmentPlan {
  const team = checkTeam(data, studentNumbers, now)
  return team.ok ? { ok: false, code: "NO_FREE_SLOTS" } : team
}
