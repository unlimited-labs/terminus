import type { z } from "zod"

import { warsawDateTime } from "../domain/slots.ts"
import type { Result } from "../messages.pl.ts"
import type { examSchema } from "../schemas/exam.ts"

import { withExamLock } from "./exam-lock.server.ts"
import { parseFields } from "./exam-state.server.ts"

/** Poprawka = nowe zaliczenie: ustawienia i (opcjonalnie) listy z nazwiskami, bez slotów i zapisów. */
export function copyExam(
  examId: string,
  ownerId: string,
  copyRosters: boolean,
): Promise<Result<{ examId: string }>> {
  return withExamLock(examId, ownerId, async (tx): Promise<Result<{ examId: string }>> => {
    const source = await tx.exam.findUniqueOrThrow({
      where: { id: examId },
      include: { rosters: { include: { entries: true } } },
    })
    const copy = await tx.exam.create({
      data: {
        ownerId,
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
  })
}

/** Maksymalnej wielkości zespołu nie da się zmniejszyć poniżej największego istniejącego zespołu. */
export async function updateExamSettings(
  examId: string,
  ownerId: string,
  data: z.infer<typeof examSchema>,
): Promise<Result> {
  return withExamLock(examId, ownerId, async (tx): Promise<Result> => {
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
export function examRecord({ opensDate, opensTime, ...rest }: z.infer<typeof examSchema>) {
  return {
    ...rest,
    enrollmentOpensAt: opensDate && opensTime ? warsawDateTime(opensDate, opensTime) : null,
  }
}

/** Usunięcie zaliczenia z listami, slotami i zapisami; trzeba przepisać jego nazwę. */
export function removeExam(examId: string, ownerId: string, confirmName: string): Promise<Result> {
  return withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    const exam = await tx.exam.findUniqueOrThrow({ where: { id: examId } })
    if (exam.name !== confirmName.trim()) return { ok: false, code: "NAME_MISMATCH" }
    await tx.exam.delete({ where: { id: examId } })
    return { ok: true }
  })
}
