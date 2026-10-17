import { z } from "zod"

import { EMAIL_MAX } from "./limits.ts"

/** Adres e-mail do logowania, gdy lista go nie podaje. */
export const defaultEmail = (studentNumber: string) => `${studentNumber}@student.agh.edu.pl`

const emailSchema = z.email().max(EMAIL_MAX)

/** Adres po przycięciu i zamianie na małe litery; `null` = pusty albo niepoprawny. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return emailSchema.safeParse(email).success ? email : null
}
