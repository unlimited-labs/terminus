import { z } from "zod"

import { GRADES } from "../domain/board.ts"
import type { ExamPhase } from "../domain/schedule.ts"

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
