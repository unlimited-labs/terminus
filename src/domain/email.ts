import { z } from "zod"

import { EMAIL_MAX } from "./limits.ts"

/** Adres e-mail do logowania, gdy lista go nie podaje. */
export const defaultEmail = (studentNumber: string) => `${studentNumber}@student.agh.edu.pl`

/** Pusty albo brak adresu = adres domyślny. */
export const emailOrDefault = (studentNumber: string, email?: string | null) =>
  email || defaultEmail(studentNumber)

const emailSchema = z.email().max(EMAIL_MAX)

/** Adres po przycięciu i zamianie na małe litery; `null` = pusty albo niepoprawny. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return emailSchema.safeParse(email).success ? email : null
}
