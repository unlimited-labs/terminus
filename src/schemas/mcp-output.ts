import { z } from "zod"

import { GRADES } from "../domain/board.ts"
import type { InvalidRowReason } from "../domain/csv.ts"
import type { ExamPhase } from "../domain/schedule.ts"

import { boardCommandSchema } from "./board.ts"
import { assignmentMode } from "./exam.ts"

/** Wyniki narzędzi MCP (`structuredContent`): chwile jako ISO po warszawsku z offsetem. */
const instant = z.iso.datetime({ offset: true })

const phase = z.enum(["draft", "scheduled", "open", "done"] satisfies ExamPhase[])

export const listExamsOutput = z.object({
  exams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      phase,
      entries: z.int(),
      enrolled: z.int(),
      firstSlotStart: instant.nullable(),
      lastSlotEnd: instant.nullable(),
      opensAt: instant.nullable(),
      coTeachers: z.array(z.string()),
    }),
  ),
})

export const examDetailOutput = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  defaultSlotMinutes: z.int(),
  maxTeamSize: z.int(),
  assignmentMode,
  requireEmailLogin: z.boolean(),
  showSlotTimes: z.boolean(),
  enrollmentOpensAt: instant.nullable(),
  emailLoginAvailable: z.boolean(),
  teachers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      banned: z.boolean().nullable(),
    }),
  ),
  rosters: z.array(z.object({ id: z.string(), name: z.string() })),
  fields: z.array(z.object({ id: z.string(), label: z.string(), required: z.boolean() })),
  slots: z.array(
    z.object({ id: z.string(), rosterId: z.string(), startsAt: instant, endsAt: instant }),
  ),
  people: z.array(
    z.object({
      studentNumber: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      rosterId: z.string(),
      slotId: z.string().nullable(),
      answers: z.record(z.string(), z.string()),
      grade: z.enum(GRADES).nullable(),
      gradeComment: z.string().nullable(),
      gradedAt: instant.nullable(),
      gradedBy: z.string().nullable(),
    }),
  ),
  phase,
  now: instant,
  link: z.url().describe("Strona zapisów dla studentów"),
})

export const emptyOutput = z.object({})

export const createExamOutput = z.object({ examId: z.string() })

export const examCsvOutput = z.object({ fileName: z.string(), csv: z.string() })

export const entryEmailsOutput = z.object({
  emails: z.record(z.string(), z.string()).describe("Numer indeksu → adres e-mail"),
})

export const slotWindowOutput = z.object({ count: z.int().describe("Liczba utworzonych slotów") })

export const freeSlotsDeletedOutput = z.object({
  deleted: z.int(),
  skipped: z.int().describe("Sloty z zapisami, które zostały"),
})

const fileRow = z.object({
  line: z.int(),
  studentNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
})

const listedEntry = z.object({
  studentNumber: z.string(),
  rosterId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  slotStartsAt: instant.nullable(),
  grade: z.enum(GRADES).nullable(),
})

export const rosterImportPreviewOutput = z.object({
  rosterId: z.string().nullable().describe("`null` = import utworzy nową listę"),
  people: z.int(),
  withdrawn: z.int().describe("Skreśleni lub z rezygnacją w pliku"),
  invalid: z.array(
    z.object({
      line: z.int(),
      studentNumber: z.string(),
      reason: z.enum([
        "NOT_DIGITS",
        "TOO_LONG",
        "BAD_NAME",
        "DUPLICATE_IN_FILE",
      ] satisfies InvalidRowReason[]),
    }),
  ),
  badEmails: z.int().describe("Niepoprawne adresy z pliku, zastąpione domyślnymi"),
  add: z.array(fileRow),
  update: z.array(fileRow).describe("Zmienione nazwiska"),
  unchanged: z.int(),
  otherRoster: z.array(fileRow).describe("Błędne: indeks jest już na innej liście"),
  remove: z.array(listedEntry).describe("Skreśleni — znikną z listy"),
  withdrawnEnrolled: z
    .array(listedEntry.extend({ slotStartsAt: instant }))
    .describe("Skreśleni z zapisem — znikną z listy, a ich zapis zostanie usunięty"),
  notInFile: z.array(listedEntry).describe("Na liście, ale nie ma ich w pliku — zostają"),
})

export const boardCommandOutput = z.object({
  inverse: boardCommandSchema.describe("Polecenie cofające tę zmianę: podaj je do `board_command`"),
})
