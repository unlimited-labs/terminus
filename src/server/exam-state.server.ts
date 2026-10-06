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
      owner: { select: { name: true } },
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
    ownerName: exam.owner.name,
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
