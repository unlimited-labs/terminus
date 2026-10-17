import { consola } from "consola"
import { RateLimiterMemory } from "rate-limiter-flexible"

import { OPS } from "../messages.pl.ts"

import type { EnrollmentOutcome } from "./enrollment.server.ts"

const MAX_POINTS = 10

// ponytail: liczniki w pamięci jednego procesu, zerowane po restarcie (SPEC §4).
const failures = new RateLimiterMemory({ points: MAX_POINTS, duration: 10 * 60 })

const HOUR = 60 * 60
// Prośby o link liczą się przy każdym żądaniu (także udanym): wysyłka maila to koszt i zalew skrzynki.
const linksPerIndex = new RateLimiterMemory({ points: 3, duration: HOUR })
const linksPerIp = new RateLimiterMemory({ points: 10, duration: HOUR })

const PENALIZED = new Set(["NOT_ON_ROSTER", "SLOT_UNAVAILABLE"])

let warnedNoIp = false

/** Klucz limitu: IP z `X-Real-IP` od reverse proxy; bez nagłówka wszyscy dzielą jeden licznik. */
export function limitKey(realIp: string | undefined) {
  if (!realIp && !warnedNoIp && process.env.NODE_ENV === "production") {
    warnedNoIp = true
    consola.warn(OPS.noRealIp)
  }
  return realIp ?? "unknown"
}

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
  if (!outcome.ok && outcome.code && PENALIZED.has(outcome.code)) {
    await failures.penalty(ip, studentNumbers.length)
  }
}

/** Prośba o link: 3 na godzinę dla zaliczenia + indeksu i 10 na godzinę z jednego IP; `false` = limit. */
export async function takeLinkAllowance(ip: string, examId: string, studentNumber: string) {
  const results = await Promise.allSettled([
    linksPerIndex.consume(`${examId}:${studentNumber}`),
    linksPerIp.consume(ip),
  ])
  return results.every((r) => r.status === "fulfilled")
}
