import type { z } from "zod"

import { parseRosterCsv, planRosterImport } from "../domain/csv.ts"
import { defaultEmail } from "../domain/email.ts"
import type { Result } from "../messages.pl.ts"
import type { addEntrySchema } from "../schemas/roster.ts"

import { db } from "./db.server.ts"
import { getOwnedExam, rosterInExam, withExamLock, type Tx } from "./exam-access.server.ts"

async function planImport(tx: Tx, examId: string, rosterName: string, csv: string) {
  const parsed = parseRosterCsv(csv)
  if (!parsed.ok) return parsed
  const [roster, entries] = await Promise.all([
    tx.roster.findUnique({ where: { examId_name: { examId, name: rosterName } } }),
    tx.rosterEntry.findMany({
      where: { examId },
      include: { enrollment: { select: { slot: { select: { startsAt: true } } } } },
    }),
  ])
  const existing = entries.map((e) => ({
    studentNumber: e.studentNumber,
    rosterId: e.rosterId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    slotStartsAt: e.enrollment?.slot.startsAt ?? null,
  }))
  const rosterId = roster?.id ?? null
  const plan = planRosterImport(parsed, rosterId ?? "", existing)
  return {
    ok: true as const,
    rosterId,
    people: parsed.rows.length,
    withdrawn: parsed.withdrawn.length,
    invalid: parsed.invalid,
    badEmails: parsed.badEmails,
    ...plan,
  }
}

type ImportPreview = Extract<Awaited<ReturnType<typeof planImport>>, { ok: true }>

/** Bez blokady, żeby nie wstrzymywać zapisów; `applyImport` pod blokadą i tak odrzuca nieaktualny podgląd. */
export async function previewImport(
  examId: string,
  userId: string,
  rosterName: string,
  csv: string,
): Promise<Result<ImportPreview>> {
  if (!(await getOwnedExam(examId, userId))) return { ok: false, code: "NOT_FOUND" }
  return planImport(db, examId, rosterName, csv)
}

export async function applyImport(
  examId: string,
  userId: string,
  rosterName: string,
  csv: string,
  /** Skreśleni z zapisem z zatwierdzonego podglądu: inny skład = zapisy zmieniły się od podglądu. */
  previewedWithdrawnEnrolled: string[],
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const plan = await planImport(tx, examId, rosterName, csv)
    if (!plan.ok) return plan
    const withdrawnEnrolledNow = plan.withdrawnEnrolled.map((e) => e.studentNumber).toSorted()
    if (withdrawnEnrolledNow.join() !== previewedWithdrawnEnrolled.toSorted().join()) {
      return { ok: false, code: "IMPORT_PREVIEW_STALE" }
    }
    const rosterId =
      plan.rosterId ?? (await tx.roster.create({ data: { examId, name: rosterName } })).id
    await tx.rosterEntry.createMany({
      data: plan.add.map(({ studentNumber, firstName, lastName, email }) => ({
        examId,
        rosterId,
        studentNumber,
        firstName,
        lastName,
        email: email ?? defaultEmail(studentNumber),
      })),
    })
    await Promise.all(
      plan.update.map(({ studentNumber, firstName, lastName, email }) =>
        tx.rosterEntry.update({
          where: { examId_studentNumber: { examId, studentNumber } },
          // Pusty albo niepoprawny adres w pliku nie nadpisuje zapisanego.
          data: { firstName, lastName, ...(email && { email }) },
        }),
      ),
    )
    // Skreślony traci zapis (reszta zespołu zostaje w slocie), potem znika z listy.
    const removed = plan.remove.map((e) => e.studentNumber)
    await tx.enrollment.deleteMany({ where: { examId, studentNumber: { in: removed } } })
    await tx.rosterEntry.deleteMany({ where: { examId, studentNumber: { in: removed } } })
    return { ok: true }
  })
}

/** Bez wskazanej listy osoba trafia na nową listę „lista” — tylko gdy zaliczenie nie ma jeszcze żadnej. */
export async function addEntry(
  examId: string,
  userId: string,
  {
    rosterId,
    studentNumber,
    firstName,
    lastName,
    email,
  }: Omit<z.infer<typeof addEntrySchema>, "examId" | "email"> & { email?: string },
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const current = await tx.rosterEntry.findUnique({
      where: { examId_studentNumber: { examId, studentNumber } },
      include: { roster: { select: { name: true } } },
    })
    if (current) return { ok: false, code: "ENTRY_EXISTS", rosterName: current.roster.name }
    let targetRosterId = rosterId
    if (!targetRosterId) {
      if ((await tx.roster.count({ where: { examId } })) > 0) {
        return { ok: false, code: "ROSTER_NOT_CHOSEN" }
      }
      targetRosterId = (await tx.roster.create({ data: { examId, name: "lista" } })).id
    } else if (!(await rosterInExam(tx, examId, targetRosterId))) {
      return { ok: false, code: "NOT_FOUND" }
    }
    await tx.rosterEntry.create({
      data: {
        examId,
        rosterId: targetRosterId,
        studentNumber,
        firstName,
        lastName,
        email: email || defaultEmail(studentNumber),
      },
    })
    return { ok: true }
  })
}

/** Adresy wpisów listy; tylko dla prowadzącego, poza stanem zaliczenia i tablicą. */
export async function entryEmails(examId: string, userId: string) {
  if (!(await getOwnedExam(examId, userId))) return null
  const entries = await db.rosterEntry.findMany({
    where: { examId },
    select: { studentNumber: true, email: true },
  })
  return Object.fromEntries(entries.map((e) => [e.studentNumber, e.email]))
}

export async function setEntryEmail(
  examId: string,
  userId: string,
  studentNumber: string,
  email: string,
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const { count } = await tx.rosterEntry.updateMany({
      where: { examId, studentNumber },
      data: { email: email || defaultEmail(studentNumber) },
    })
    return count > 0 ? { ok: true } : { ok: false, code: "NOT_FOUND" }
  })
}

export async function deleteEntry(
  examId: string,
  userId: string,
  studentNumber: string,
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
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
}

/** Listy nie da się usunąć, dopóki ktoś z niej jest zapisany albo ktoś siedzi w jej slocie. */
export async function removeRoster(
  examId: string,
  userId: string,
  rosterId: string,
): Promise<Result> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<Result> => {
    const enrolled = await tx.enrollment.count({
      where: { examId, OR: [{ entry: { rosterId } }, { slot: { rosterId } }] },
    })
    if (enrolled > 0) return { ok: false, code: "ROSTER_HAS_ENROLLMENTS" }
    await tx.roster.deleteMany({ where: { id: rosterId, examId } })
    return { ok: true }
  })
}
