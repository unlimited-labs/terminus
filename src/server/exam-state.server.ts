import { z } from "zod"

import type { Answers, ExamField } from "../domain/fields.ts"
import { examPhase } from "../domain/schedule.ts"

import { db } from "./db.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import type { Tx } from "./exam-access.server.ts"

// Sam kształt, bez limitów formularza: zaostrzenie limitu nie może zablokować odczytu starych danych.
const storedFields = z.array(z.object({ id: z.string(), label: z.string(), required: z.boolean() }))
const storedAnswers = z.record(z.string(), z.string())

export const parseFields = (json: unknown): ExamField[] => storedFields.parse(json)

const parseAnswers = (json: unknown): Answers => storedAnswers.parse(json)

/** Pełny stan zaliczenia: ustawienia, listy, wpisy (z zapisem) i sloty; `client` = transakcja pod blokadą. */
export async function loadExam(examId: string, client: Tx | typeof db = db) {
  const exam = await client.exam.findUnique({
    where: { id: examId },
    include: {
      teachers: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, banned: true },
      },
      rosters: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      enrollments: {
        select: {
          studentNumber: true,
          slotId: true,
          answers: true,
          grade: true,
          gradeComment: true,
          gradedAt: true,
          gradedBy: { select: { name: true } },
        },
      },
    },
  })
  if (!exam) return null
  const [entries, slots] = await Promise.all([
    client.rosterEntry.findMany({
      where: { examId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { studentNumber: true, firstName: true, lastName: true, rosterId: true },
    }),
    client.slot.findMany({
      where: { examId },
      orderBy: { startsAt: "asc" },
      select: { id: true, rosterId: true, startsAt: true, endsAt: true },
    }),
  ])
  const enrollmentOf = new Map(exam.enrollments.map((e) => [e.studentNumber, e]))
  const now = new Date()
  // Sloty są posortowane po startsAt i nie nachodzą na siebie (findOverlap), więc ostatni kończy się najpóźniej.
  const lastSlotEnd = slots.at(-1)?.endsAt ?? null
  return {
    id: exam.id,
    name: exam.name,
    description: exam.description,
    teachers: exam.teachers,
    defaultSlotMinutes: exam.defaultSlotMinutes,
    maxTeamSize: exam.maxTeamSize,
    assignmentMode: exam.assignmentMode,
    requireEmailLogin: exam.requireEmailLogin,
    emailLoginAvailable,
    enrollmentOpensAt: exam.enrollmentOpensAt,
    fields: parseFields(exam.fields),
    rosters: exam.rosters,
    slots,
    people: entries.map((e) => {
      const enrollment = enrollmentOf.get(e.studentNumber)
      return {
        ...e,
        slotId: enrollment?.slotId ?? null,
        answers: enrollment ? parseAnswers(enrollment.answers) : {},
        grade: enrollment?.grade ?? null,
        gradeComment: enrollment?.gradeComment ?? null,
        gradedAt: enrollment?.gradedAt ?? null,
        /** null przy `gradedAt` = konto prowadzącego usunięte. */
        gradedBy: enrollment?.gradedBy?.name ?? null,
      }
    }),
    phase: examPhase(
      { entries: entries.length, lastSlotEnd, opensAt: exam.enrollmentOpensAt },
      now,
    ),
    now,
  }
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof loadExam>>>

/** Publiczny harmonogram: sloty z imionami i nazwiskami, bez numerów indeksów. */
export async function loadSchedule(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      name: true,
      description: true,
      maxTeamSize: true,
      assignmentMode: true,
      requireEmailLogin: true,
      fields: true,
      enrollmentOpensAt: true,
      teachers: { orderBy: { name: "asc" }, select: { name: true } },
      rosters: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  })
  if (!exam) return null
  const slots = await db.slot.findMany({
    where: { examId },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      rosterId: true,
      startsAt: true,
      endsAt: true,
      enrollments: {
        select: { entry: { select: { firstName: true, lastName: true } } },
        orderBy: { entry: { lastName: "asc" } },
      },
    },
  })
  return {
    name: exam.name,
    description: exam.description,
    teacherNames: exam.teachers.map((t) => t.name).join(", "),
    maxTeamSize: exam.maxTeamSize,
    assignmentMode: exam.assignmentMode,
    requireEmailLogin: exam.requireEmailLogin,
    opensAt: exam.enrollmentOpensAt,
    fields: parseFields(exam.fields),
    rosters: exam.rosters,
    now: new Date(),
    slots: slots.map(({ enrollments, ...slot }) => ({
      ...slot,
      team: enrollments.map((e) => e.entry),
    })),
  }
}
