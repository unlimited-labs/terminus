import { applyCommand, changedPeople, type BoardCommand } from "../domain/board.ts"
import { cleanAnswers, type ExamField } from "../domain/fields.ts"
import type { Result } from "../messages.pl.ts"

import { withExamLock, type Tx } from "./exam-access.server.ts"
import { loadExam, type ExamDetail } from "./exam-state.server.ts"

type Person = ExamDetail["people"][number]

async function savePerson(tx: Tx, examId: string, prev: Person, next: Person) {
  const key = { examId_studentNumber: { examId, studentNumber: next.studentNumber } }
  if (prev.firstName !== next.firstName || prev.lastName !== next.lastName) {
    await tx.rosterEntry.update({
      where: key,
      data: { firstName: next.firstName, lastName: next.lastName },
    })
  }
  const { slotId, answers } = next
  if (slotId === null) {
    if (prev.slotId !== null) await tx.enrollment.delete({ where: key })
  } else if (prev.slotId === null) {
    await tx.enrollment.create({
      data: { examId, studentNumber: next.studentNumber, slotId, answers },
    })
  } else if (prev.slotId !== slotId || prev.answers !== answers) {
    await tx.enrollment.update({ where: key, data: { slotId, answers } })
  }
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
    const before = await loadExam(examId, tx)
    if (!before) return { ok: false, code: "NOT_FOUND" }
    const applied = applyCommand(before, withCleanAnswers(command, before.fields))
    if (!applied.ok) return applied
    await Promise.all(
      changedPeople(before, applied.state).map(([prev, next]) =>
        savePerson(tx, examId, prev, next),
      ),
    )
    return { ok: true, inverse: applied.inverse }
  })
}
