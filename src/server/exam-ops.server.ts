import type { z } from "zod"

import { buildExportCsv, exportFileName } from "../domain/csv.ts"
import { examPhase } from "../domain/schedule.ts"
import { warsawDateTime } from "../domain/time.ts"
import type { Result } from "../messages.pl.ts"
import type { examSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"
import { getOwnedExam, withExamLock, type ExamAccess } from "./exam-access.server.ts"
import { loadExam, parseFields } from "./exam-state.server.ts"

/** Zaliczenia, których konto jest prowadzącym, od najnowszych, z etapem i terminami do listy. */
export async function examsOf(userId: string, now = new Date()) {
  const mine = { teachers: { some: { id: userId } } }
  const [exams, spans] = await Promise.all([
    db.exam.findMany({
      where: mine,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
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
  const exam = await db.exam.create({
    data: { ...examRecord(data), teachers: { connect: { id: userId } } },
  })
  return { ok: true, examId: exam.id }
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
        include: { rosters: { include: { entries: true } } },
      })
      const copy = await tx.exam.create({
        data: {
          teachers: { connect: { id: userId } },
          name: `${source.name} (kopia)`,
          description: source.description,
          defaultSlotMinutes: source.defaultSlotMinutes,
          maxTeamSize: source.maxTeamSize,
          fields: parseFields(source.fields),
          enrollmentOpensAt: source.enrollmentOpensAt,
        },
      })
      if (!copyRosters) return { ok: true, examId: copy.id }
      await Promise.all(
        source.rosters.map((roster) =>
          tx.roster.create({
            data: {
              examId: copy.id,
              name: roster.name,
              entries: {
                createMany: {
                  data: roster.entries.map(({ studentNumber, firstName, lastName }) => ({
                    studentNumber,
                    firstName,
                    lastName,
                  })),
                },
              },
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
    if (exam.name !== confirmName.trim()) return { ok: false, code: "NAME_MISMATCH" }
    await tx.exam.delete({ where: { id: examId } })
    return { ok: true }
  })
}

/** Dodanie prowadzącego po e-mailu konta (bez rozróżniania wielkości liter). */
export function addTeacher(examId: string, userId: string, email: string): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const teacher = await tx.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
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
