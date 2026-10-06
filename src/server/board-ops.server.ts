import { applyCommand, changedPeople, type BoardCommand } from "../domain/board.ts"
import { checkAnswers, type Answers } from "../domain/fields.ts"
import type { Result } from "../messages.pl.ts"

import { withExamLock, type Tx } from "./exam-lock.server.ts"
import { parseAnswers, parseFields } from "./exam-state.server.ts"

type Person = {
  studentNumber: string
  slotId: string | null
  firstName: string
  lastName: string
  answers: Answers
}

async function loadBoardState(tx: Tx, examId: string) {
  const [exam, slots, entries] = await Promise.all([
    tx.exam.findUniqueOrThrow({ where: { id: examId }, select: { maxTeamSize: true } }),
    tx.slot.findMany({ where: { examId }, select: { id: true } }),
    tx.rosterEntry.findMany({
      where: { examId },
      select: {
        studentNumber: true,
        firstName: true,
        lastName: true,
        enrollment: { select: { slotId: true, answers: true } },
      },
    }),
  ])
  return {
    maxTeamSize: exam.maxTeamSize,
    slots,
    people: entries.map(({ enrollment, ...p }): Person => ({
      ...p,
      slotId: enrollment?.slotId ?? null,
      answers: parseAnswers(enrollment?.answers),
    })),
  }
}

/**
 * Kto dołącza do istniejącego zespołu, przejmuje jego odpowiedzi; przeniesiony cały zespół
 * zachowuje swoje; Cofnij wypisania wraca z odpowiedziami z polecenia.
 */
async function savePerson(
  tx: Tx,
  examId: string,
  prev: Person,
  next: Person,
  teamAnswers?: Answers,
) {
  const key = { examId_studentNumber: { examId, studentNumber: next.studentNumber } }
  if (prev.firstName !== next.firstName || prev.lastName !== next.lastName) {
    await tx.rosterEntry.update({
      where: key,
      data: { firstName: next.firstName, lastName: next.lastName },
    })
  }
  if (prev.slotId === next.slotId) return
  const answers = teamAnswers ?? next.answers
  if (next.slotId === null) await tx.enrollment.delete({ where: key })
  else if (prev.slotId === null) {
    await tx.enrollment.create({
      data: { examId, studentNumber: next.studentNumber, slotId: next.slotId, answers },
    })
  } else await tx.enrollment.update({ where: key, data: { slotId: next.slotId, answers } })
}

type CommandResult = Result<{ inverse: BoardCommand }>

export async function runBoardCommand(
  examId: string,
  ownerId: string,
  command: BoardCommand,
): Promise<CommandResult> {
  return withExamLock(examId, ownerId, async (tx): Promise<CommandResult> => {
    const before = await loadBoardState(tx, examId)
    const applied = applyCommand(before, command)
    if (!applied.ok) return applied
    const old = new Map(before.people.map((p) => [p.studentNumber, p]))
    const stayers = new Map(
      applied.state.people
        .filter((p) => p.slotId !== null && old.get(p.studentNumber)?.slotId === p.slotId)
        .map((p) => [p.slotId, p.answers]),
    )
    await Promise.all(
      changedPeople(before, applied.state).map((p) =>
        savePerson(
          tx,
          examId,
          old.get(p.studentNumber)!,
          p,
          p.slotId ? stayers.get(p.slotId) : undefined,
        ),
      ),
    )
    return { ok: true, inverse: applied.inverse }
  })
}

/** Prowadzący poprawia odpowiedzi zespołu w slocie (bez sprawdzania wymaganych pól). */
export async function setSlotAnswers(
  examId: string,
  ownerId: string,
  slotId: string,
  answers: Answers,
): Promise<Result> {
  return withExamLock(examId, ownerId, async (tx): Promise<Result> => {
    const exam = await tx.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { fields: true },
    })
    const cleaned = checkAnswers(
      parseFields(exam.fields).map((f) => ({ ...f, required: false })),
      answers,
    )
    const { count } = await tx.enrollment.updateMany({
      where: { examId, slotId },
      data: { answers: cleaned.ok ? cleaned.answers : {} },
    })
    return count > 0 ? { ok: true } : { ok: false, code: "SLOT_NOT_FOUND" }
  })
}
