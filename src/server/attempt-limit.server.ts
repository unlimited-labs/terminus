import { RateLimiterMemory } from "rate-limiter-flexible"

const MAX_FAILURES = 10

// ponytail: liczniki w pamięci jednego procesu, zerowane po restarcie (SPEC §4).
const failures = new RateLimiterMemory({ points: MAX_FAILURES, duration: 10 * 60 })

/** Limit nieudanych prób "indeksu nie ma na liście" z jednego IP. */
export async function isBlocked(ip: string) {
  const state = await failures.get(ip)
  return (state?.consumedPoints ?? 0) >= MAX_FAILURES
}

/**
 * „Nie ma na liście” wskazuje brakujące numery, więc potwierdza resztę: kara = liczba
 * sprawdzonych numerów, żeby wyliczanie indeksów zespołem kosztowało tyle co pojedynczo.
 */
export async function recordOutcome(
  ip: string,
  studentNumbers: string[],
  outcome: { ok: boolean; code?: string },
) {
  if (!outcome.ok && outcome.code === "NOT_ON_ROSTER") {
    await failures.penalty(ip, studentNumbers.length)
  }
}
