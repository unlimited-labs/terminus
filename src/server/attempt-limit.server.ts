import { RateLimiterMemory } from "rate-limiter-flexible"

import type { EnrollmentOutcome } from "./enrollment.server.ts"

const MAX_POINTS = 10

// ponytail: liczniki w pamięci jednego procesu, zerowane po restarcie (SPEC §4).
const failures = new RateLimiterMemory({ points: MAX_POINTS, duration: 10 * 60 })

/** 10 punktów kary na 10 minut z jednego IP; punkty nalicza `recordOutcome`. */
export async function isBlocked(ip: string) {
  const state = await failures.get(ip)
  return (state?.consumedPoints ?? 0) >= MAX_POINTS
}

/**
 * „Nie ma na liście” wskazuje brakujące numery, więc potwierdza resztę: kara = liczba
 * sprawdzonych numerów, żeby wyliczanie indeksów zespołem kosztowało tyle co pojedynczo.
 */
export async function recordOutcome(
  ip: string,
  studentNumbers: string[],
  outcome: { ok: boolean; code?: Extract<EnrollmentOutcome, { ok: false }>["code"] },
) {
  if (!outcome.ok && outcome.code === "NOT_ON_ROSTER") {
    await failures.penalty(ip, studentNumbers.length)
  }
}
