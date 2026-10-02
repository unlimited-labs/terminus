import type { z } from "zod"

import { parseRosterCsv, planRosterImport } from "../domain/csv.ts"
import type { Result } from "../messages.pl.ts"
import type { addEntrySchema } from "../schemas/roster.ts"

import { withExamLock, type Tx } from "./exam-lock.server.ts"

async function planImport(tx: Tx, examId: string, rosterName: string, csv: string) {
  const parsed = parseRosterCsv(csv)
  if (!parsed.ok) return parsed
  const [roster, entries] = await Promise.all([
    tx.roster.findUnique({ where: { examId_name: { examId, name: rosterName } } }),
    tx.rosterEntry.findMany({
      where: { examId },
      include: { enrollment: { select: { slotId: true } } },
    }),
  ])
  const existing = entries.map((e) => ({ ...e, enrolled: e.enrollment !== null }))
  const plan = planRosterImport(parsed, roster?.id ?? "", existing)
  return {
    ok: true as const,
    rosterId: roster?.id ?? null,
    people: parsed.rows.length,
    withdrawn: parsed.withdrawn.length,
    invalid: parsed.invalid,
    ...plan,
  }
}

type ImportPreview = Extract<Awaited<ReturnType<typeof planImport>>, { ok: true }>

export async function previewImport(
  examId: string,
  ownerId: string,
  rosterName: string,
  csv: string,
): Promise<Result<ImportPreview>> {
  const result = await withExamLock(examId, ownerId, (tx) =>
    planImport(tx, examId, rosterName, csv),
  )
  return result ?? { ok: false, code: "NOT_FOUND" }
}

export async function applyImport(
  examId: string,
  ownerId: string,
  rosterName: string,
  csv: string,
): Promise<Result> {
  const result = await withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    const plan = await planImport(tx, examId, rosterName, csv)
    if (!plan.ok) return plan
    const rosterId =
      plan.rosterId ?? (await tx.roster.create({ data: { examId, name: rosterName } })).id
    await tx.rosterEntry.createMany({
      data: plan.add.map(({ studentNumber, firstName, lastName }) => ({
        examId,
        rosterId,
        studentNumber,
        firstName,
        lastName,
      })),
    })
    await Promise.all(
      plan.update.map(({ studentNumber, firstName, lastName }) =>
        tx.rosterEntry.update({
          where: { examId_studentNumber: { examId, studentNumber } },
          data: { firstName, lastName },
        }),
      ),
    )
    await tx.rosterEntry.deleteMany({
      where: { examId, studentNumber: { in: plan.remove.map((e) => e.studentNumber) } },
    })
    return { ok: true }
  })
  return result ?? { ok: false, code: "NOT_FOUND" }
}

/** Bez wskazanej listy osoba trafia na pierwszą listę zaliczenia; nieistniejąca lista = nowa „lista”. */
export async function addEntry(
  examId: string,
  ownerId: string,
  { rosterId, studentNumber, firstName, lastName }: Omit<z.infer<typeof addEntrySchema>, "examId">,
): Promise<Result> {
  const result = await withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    const current = await tx.rosterEntry.findUnique({
      where: { examId_studentNumber: { examId, studentNumber } },
      include: { roster: { select: { name: true } } },
    })
    if (current) return { ok: false, code: "ENTRY_EXISTS", rosterName: current.roster.name }
    const roster =
      (await tx.roster.findFirst({ where: { examId, id: rosterId || undefined } })) ??
      (await tx.roster.create({ data: { examId, name: "lista" } }))
    await tx.rosterEntry.create({
      data: { examId, rosterId: roster.id, studentNumber, firstName, lastName },
    })
    return { ok: true }
  })
  return result ?? { ok: false, code: "NOT_FOUND" }
}

export async function deleteEntry(
  examId: string,
  ownerId: string,
  studentNumber: string,
): Promise<Result> {
  const result = await withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    if (
      await tx.enrollment.findUnique({
        where: { examId_studentNumber: { examId, studentNumber } },
      })
    ) {
      return { ok: false, code: "ENTRY_HAS_ENROLLMENT" }
    }
    await tx.rosterEntry.deleteMany({ where: { examId, studentNumber } })
    return { ok: true }
  })
  return result ?? { ok: false, code: "NOT_FOUND" }
}

/** Listy nie da się usunąć, dopóki ktoś z niej jest zapisany albo ktoś siedzi w jej slocie. */
export async function removeRoster(
  examId: string,
  ownerId: string,
  rosterId: string,
): Promise<Result> {
  const result = await withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    const enrolled = await tx.enrollment.count({
      where: { examId, OR: [{ entry: { rosterId } }, { slot: { rosterId } }] },
    })
    if (enrolled > 0) return { ok: false, code: "ROSTER_HAS_ENROLLMENTS" }
    await tx.roster.deleteMany({ where: { id: rosterId, examId } })
    return { ok: true }
  })
  return result ?? { ok: false, code: "NOT_FOUND" }
}
