import { RateLimiterMemory } from "rate-limiter-flexible"

const MAX_FAILURES = 10

// ponytail: liczniki w pamięci jednego procesu, zerowane po restarcie (SPEC §4).
const failures = new RateLimiterMemory({ points: MAX_FAILURES, duration: 10 * 60 })

/** Limit nieudanych prób "indeksu nie ma na liście" z jednego IP. */
export async function isBlocked(ip: string) {
  const state = await failures.get(ip)
  return (state?.consumedPoints ?? 0) >= MAX_FAILURES
}

export async function recordFailure(ip: string) {
  await failures.penalty(ip, 1)
}
