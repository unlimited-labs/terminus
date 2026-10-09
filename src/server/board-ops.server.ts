import { applyCommand, changedPeople, type BoardCommand } from "../domain/board.ts"
import { cleanAnswers, type Answers, type ExamField } from "../domain/fields.ts"
import type { Result } from "../messages.pl.ts"

import { withExamLock, type Tx } from "./exam-access.server.ts"
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
    tx.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { maxTeamSize: true, fields: true },
    }),
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
    fields: parseFields(exam.fields),
    slots,
    people: entries.map(({ enrollment, ...p }): Person => ({
      ...p,
      slotId: enrollment?.slotId ?? null,
      answers: parseAnswers(enrollment?.answers),
    })),
  }
}

async function savePerson(tx: Tx, examId: string, prev: Person, next: Person) {
  const key = { examId_studentNumber: { examId, studentNumber: next.studentNumber } }
  if (prev.firstName !== next.firstName || prev.lastName !== next.lastName) {
    await tx.rosterEntry.update({
      where: key,
      data: { firstName: next.firstName, lastName: next.lastName },
    })
  }
  const { answers } = next
  if (prev.slotId === next.slotId) {
    if (next.slotId !== null && prev.answers !== answers)
      await tx.enrollment.update({ where: key, data: { answers } })
  } else if (next.slotId === null) await tx.enrollment.delete({ where: key })
  else if (prev.slotId === null) {
    await tx.enrollment.create({
      data: { examId, studentNumber: next.studentNumber, slotId: next.slotId, answers },
    })
  } else await tx.enrollment.update({ where: key, data: { slotId: next.slotId, answers } })
}

/** Prowadzący poprawia odpowiedzi bez sprawdzania wymaganych pól. */
function withCleanAnswers(command: BoardCommand, fields: ExamField[]): BoardCommand {
  if (command.kind !== "setAnswers") return command
  return { ...command, answers: cleanAnswers(fields, command.answers) }
}

type CommandResult = Result<{ inverse: BoardCommand }>

export async function runBoardCommand(
  examId: string,
  userId: string,
  command: BoardCommand,
): Promise<CommandResult> {
  return withExamLock(examId, { teacher: userId }, async (tx): Promise<CommandResult> => {
    const before = await loadBoardState(tx, examId)
    const applied = applyCommand(before, withCleanAnswers(command, before.fields))
    if (!applied.ok) return applied
    const old = new Map(before.people.map((p) => [p.studentNumber, p]))
    await Promise.all(
      changedPeople(before, applied.state).map((p) =>
        savePerson(tx, examId, old.get(p.studentNumber)!, p),
      ),
    )
    return { ok: true, inverse: applied.inverse }
  })
}
