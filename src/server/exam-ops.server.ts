import type { z } from "zod"

import { buildExportCsv } from "../domain/csv.ts"
import { defaultEmail } from "../domain/email.ts"
import { exportFileName } from "../domain/file-names.ts"
import { examPhase } from "../domain/schedule.ts"
import { cutWindow } from "../domain/slots.ts"
import { warsawDateTime, warsawDay } from "../domain/time.ts"
import type { Result } from "../messages.pl.ts"
import type { examSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"
import { getOwnedExam, taughtBy, withExamLock, type ExamAccess } from "./exam-access.server.ts"
import { loadExam, parseFields } from "./exam-state.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import { teacherWithEmail } from "./roles.ts"

/** Zaliczenia, których konto jest prowadzącym, od najnowszych, z etapem i terminami do listy. */
export async function examsOf(userId: string, now = new Date()) {
  const mine = taughtBy(userId)
  const [exams, spans] = await Promise.all([
    db.exam.findMany({
      where: mine,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        enrollmentOpensAt: true,
        teachers: { where: { id: { not: userId } }, select: { name: true } },
        _count: { select: { enrollments: true } },
        rosters: { select: { _count: { select: { entries: true } } } },
      },
    }),
    db.slot.groupBy({
      by: ["examId"],
      where: { roster: { exam: mine } },
      _min: { startsAt: true },
      _max: { endsAt: true },
    }),
  ])
  const spanOf = new Map(spans.map((s) => [s.examId, s]))
  return exams.map((exam) => {
    const entries = exam.rosters.reduce((n, r) => n + r._count.entries, 0)
    const span = spanOf.get(exam.id)
    const lastSlotEnd = span?._max?.endsAt ?? null
    const opensAt = exam.enrollmentOpensAt
    return {
      id: exam.id,
      name: exam.name,
      description: exam.description,
      phase: examPhase({ entries, lastSlotEnd, opensAt }, now),
      entries,
      enrolled: exam._count.enrollments,
      firstSlotStart: span?._min?.startsAt ?? null,
      lastSlotEnd,
      opensAt,
      coTeachers: exam.teachers.map((t) => t.name),
    }
  })
}

/** Pełny stan zaliczenia dla jego prowadzącego; cudze = `null`. */
export async function readExam(examId: string, userId: string) {
  return (await getOwnedExam(examId, userId)) ? loadExam(examId) : null
}

export async function insertExam(
  userId: string,
  data: z.infer<typeof examSchema>,
): Promise<Result<{ examId: string }>> {
  if (data.requireEmailLogin && !emailLoginAvailable) {
    return { ok: false, code: "EMAIL_LOGIN_UNAVAILABLE" }
  }
  const exam = await db.exam.create({
    data: { ...examRecord(data), teachers: { connect: { id: userId } } },
  })
  return { ok: true, examId: exam.id }
}

const SAMPLE_EXAM_NAME = "Przykładowe zaliczenie"

const SAMPLE_PEOPLE = [
  ["100001", "Anna", "Nowak"],
  ["100002", "Jan", "Kowalski"],
  ["100003", "Ewa", "Wiśniewska"],
  ["100004", "Piotr", "Wójcik"],
  ["100005", "Maria", "Kamińska"],
  ["100006", "Tomasz", "Lewandowski"],
] as const

/** Zaliczenie do przewodnika: lista, sloty za tydzień i dwa zapisy; drugi raz zwraca to samo. */
export async function insertSampleExam(
  userId: string,
  now = new Date(),
): Promise<Result<{ examId: string }>> {
  const existing = await db.exam.findFirst({
    where: { name: SAMPLE_EXAM_NAME, teachers: { some: { id: userId } } },
    select: { id: true },
  })
  if (existing) return { ok: true, examId: existing.id }
  const cut = cutWindow({
    date: warsawDay(new Date(now.getTime() + 7 * 86_400_000)),
    from: "09:00",
    to: "11:00",
    minutes: 20,
  })
  if (!cut.ok) return cut
  return db.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        name: SAMPLE_EXAM_NAME,
        description: "Do ćwiczeń: zmieniaj śmiało, a gdy niepotrzebne, usuń je przyciskiem Usuń.",
        defaultSlotMinutes: 20,
        maxTeamSize: 1,
        teachers: { connect: { id: userId } },
      },
    })
    const roster = await tx.roster.create({
      data: {
        examId: exam.id,
        name: "Grupa przykładowa",
        entries: {
          createMany: {
            data: SAMPLE_PEOPLE.map(([studentNumber, firstName, lastName]) => ({
              studentNumber,
              firstName,
              lastName,
              email: defaultEmail(studentNumber),
            })),
          },
        },
      },
    })
    const slots = await tx.slot.createManyAndReturn({
      data: cut.slots.map((s) => ({ ...s, examId: exam.id, rosterId: roster.id })),
      select: { id: true },
    })
    await tx.enrollment.createMany({
      data: [0, 2].map((i) => ({
        examId: exam.id,
        studentNumber: SAMPLE_PEOPLE[i]![0],
        slotId: slots[i]!.id,
      })),
    })
    return { ok: true, examId: exam.id }
  })
}

/** Eksport CSV dla prowadzącego; cudze = `NOT_FOUND`. */
export async function examCsv(
  examId: string,
  userId: string,
  now = new Date(),
): Promise<Result<{ fileName: string; csv: string }>> {
  const exam = await readExam(examId, userId)
  if (!exam) return { ok: false, code: "NOT_FOUND" }
  const rosterName = new Map(exam.rosters.map((r) => [r.id, r.name]))
  const people = exam.people.map((p) => ({ ...p, rosterName: rosterName.get(p.rosterId) ?? "" }))
  return {
    ok: true,
    fileName: exportFileName(exam.name, now),
    csv: buildExportCsv(exam.slots, people, exam.fields),
  }
}

/** Poprawka = nowe zaliczenie: ustawienia i (opcjonalnie) listy z nazwiskami, bez slotów i zapisów. */
export function copyExam(
  examId: string,
  userId: string,
  copyRosters: boolean,
): Promise<Result<{ examId: string }>> {
  return withExamLock(
    examId,
    { teacher: userId },
    async (tx): Promise<Result<{ examId: string }>> => {
      const source = await tx.exam.findUniqueOrThrow({
        where: { id: examId },
        select: {
          name: true,
          description: true,
          defaultSlotMinutes: true,
          maxTeamSize: true,
          assignmentMode: true,
          fields: true,
          enrollmentOpensAt: true,
          requireEmailLogin: true,
          showSlotTimes: true,
          rosters: {
            select: {
              name: true,
              entries: {
                select: { studentNumber: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      })
      const { rosters, name, fields, requireEmailLogin, ...settings } = source
      const copy = await tx.exam.create({
        data: {
          ...settings,
          teachers: { connect: { id: userId } },
          name: `${name} (kopia)`,
          fields: parseFields(fields),
          requireEmailLogin: requireEmailLogin && emailLoginAvailable,
        },
      })
      if (!copyRosters) return { ok: true, examId: copy.id }
      await Promise.all(
        rosters.map((roster) =>
          tx.roster.create({
            data: {
              examId: copy.id,
              name: roster.name,
              entries: { createMany: { data: roster.entries } },
            },
          }),
        ),
      )
      return { ok: true, examId: copy.id }
    },
  )
}

/** Maksymalnej wielkości zespołu nie da się zmniejszyć poniżej największego istniejącego zespołu. */
export async function updateExamSettings(
  examId: string,
  userId: string,
  data: z.infer<typeof examSchema>,
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    // Włączenie bez poczty zablokowałoby studentów; już włączoną opcję (poczta zniknęła) wolno zostawić.
    if (data.requireEmailLogin && !emailLoginAvailable) {
      const current = await tx.exam.findUniqueOrThrow({
        where: { id: examId },
        select: { requireEmailLogin: true },
      })
      if (!current.requireEmailLogin) return { ok: false, code: "EMAIL_LOGIN_UNAVAILABLE" }
    }
    const teams = await tx.enrollment.groupBy({ by: ["slotId"], where: { examId }, _count: true })
    const tooBig = teams.filter((t) => t._count > data.maxTeamSize).map((t) => t.slotId)
    if (tooBig.length > 0) {
      const slots = await tx.slot.findMany({
        where: { id: { in: tooBig } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      })
      return { ok: false, code: "TEAM_SIZE_BELOW_EXISTING", slots: slots.map((s) => s.startsAt) }
    }
    await tx.exam.update({ where: { id: examId }, data: examRecord(data) })
    return { ok: true }
  })
}

/** Wartości formularza zaliczenia → kolumny tabeli (start zapisów w czasie polskim). */
function examRecord({ opensDate, opensTime, ...rest }: z.infer<typeof examSchema>) {
  return {
    ...rest,
    enrollmentOpensAt: opensDate && opensTime ? warsawDateTime(opensDate, opensTime) : null,
  }
}

/** Usunięcie zaliczenia z listami, slotami i zapisami; trzeba przepisać jego nazwę. */
export function removeExam(
  examId: string,
  access: ExamAccess,
  confirmName: string,
): Promise<Result> {
  return withExamLock(examId, access, async (tx): Promise<Result> => {
    const exam = await tx.exam.findUniqueOrThrow({ where: { id: examId } })
    if (exam.name !== confirmName) return { ok: false, code: "NAME_MISMATCH" }
    await tx.exam.delete({ where: { id: examId } })
    return { ok: true }
  })
}

/** Dodanie prowadzącego po e-mailu konta (bez rozróżniania wielkości liter). */
export function addTeacher(examId: string, userId: string, email: string): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const teacher = await tx.user.findFirst({
      where: teacherWithEmail(email),
      select: {
        id: true,
        banned: true,
        taughtExams: { where: { id: examId }, select: { id: true } },
      },
    })
    if (!teacher) return { ok: false, code: "TEACHER_NOT_FOUND" }
    if (teacher.banned) return { ok: false, code: "TEACHER_BANNED" }
    if (teacher.taughtExams.length > 0) return { ok: false, code: "ALREADY_TEACHER" }
    await tx.exam.update({
      where: { id: examId },
      data: { teachers: { connect: { id: teacher.id } } },
    })
    return { ok: true }
  })
}

/** Usunięcie prowadzącego (także siebie); ostatniego nie można — zostaje usunięcie zaliczenia. */
export function removeTeacher(examId: string, userId: string, teacherId: string): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const { teachers } = await tx.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { teachers: { select: { id: true } } },
    })
    if (!teachers.some((t) => t.id === teacherId)) return { ok: false, code: "NOT_FOUND" }
    if (teachers.length === 1) return { ok: false, code: "LAST_TEACHER" }
    await tx.exam.update({
      where: { id: examId },
      data: { teachers: { disconnect: { id: teacherId } } },
    })
    return { ok: true }
  })
}
