import { z } from "zod"

export const E2E = {
  port: 3100,
  baseURL: "http://localhost:3100",
  admin: { email: "admin@e2e.test", password: "haslo-admina-e2e", name: "Admin E2E" },
}

export const STATE_FILE = "e2e/.state.json"

const EXAMS = [
  "boardMouse",
  "boardKeyboard",
  "boardTeam",
  "exportDuplicate",
  "fields",
  "student",
  "rosters",
  "full",
  "future",
  "raceRename",
  "raceDrag",
  "slotsDelete",
  "slotsAnswers",
  "days",
  "doomed",
  "rename",
  "blockedOwner",
  "withdrawn",
] as const

/** Każdy test, który zmienia dane, ma własne zaliczenie — pliki i testy (`-g`) działają osobno. */
export const e2eStateSchema = z.object({
  /** Dzień 0 danych testowych (YYYY-MM-DD, czas polski): dziś + 30 dni. */
  baseDay: z.iso.date(),
  exams: z.record(z.enum(EXAMS), z.uuid()),
})

export type E2EState = z.infer<typeof e2eStateSchema>

/** `base` przesunięty o `offset` dni (daty kalendarzowe, bez stref). */
export const dayOf = (base: string, offset: number) =>
  new Date(Date.parse(`${base}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
