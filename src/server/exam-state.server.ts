import { z } from "zod"

import type { Answers, ExamField } from "../domain/fields.ts"
import { answersSchema, examFieldSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"

export const parseFields = (json: unknown): ExamField[] =>
  z.array(examFieldSchema).catch([]).parse(json)

export const parseAnswers = (json: unknown): Answers => answersSchema.catch({}).parse(json)

/** Pełny stan zaliczenia: ustawienia, listy, wpisy (z zapisem) i sloty. */
export async function loadExam(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      teachers: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, banned: true },
      },
      rosters: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      enrollments: { select: { studentNumber: true, slotId: true, answers: true } },
    },
  })
  if (!exam) return null
  const [entries, slots] = await Promise.all([
    db.rosterEntry.findMany({
      where: { examId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { studentNumber: true, firstName: true, lastName: true, rosterId: true },
    }),
    db.slot.findMany({
      where: { examId },
      orderBy: { startsAt: "asc" },
      select: { id: true, rosterId: true, startsAt: true, endsAt: true },
    }),
  ])
  const slotOf = new Map(exam.enrollments.map((e) => [e.studentNumber, e.slotId]))
  const slotAnswers = new Map(exam.enrollments.map((e) => [e.slotId, parseAnswers(e.answers)]))
  return {
    id: exam.id,
    name: exam.name,
    description: exam.description,
    teachers: exam.teachers,
    defaultSlotMinutes: exam.defaultSlotMinutes,
    maxTeamSize: exam.maxTeamSize,
    enrollmentOpensAt: exam.enrollmentOpensAt,
    fields: parseFields(exam.fields),
    rosters: exam.rosters,
    slots: slots.map((s) => ({ ...s, answers: slotAnswers.get(s.id) ?? {} })),
    people: entries.map((e) => ({ ...e, slotId: slotOf.get(e.studentNumber) ?? null })),
    now: new Date(),
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
