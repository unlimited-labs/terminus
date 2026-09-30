import { applyCommand, changedPeople, type BoardCommand } from "../domain/board.ts"
import type { Result } from "../messages.pl.ts"

import { withExamLock, type Tx } from "./exam-lock.server.ts"

type Person = { studentNumber: string; slotId: string | null; firstName: string; lastName: string }

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
        enrollment: { select: { slotId: true } },
      },
    }),
  ])
  return {
    maxTeamSize: exam.maxTeamSize,
    slots,
    people: entries.map(({ enrollment, ...p }): Person => ({
      ...p,
      slotId: enrollment?.slotId ?? null,
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
  if (prev.slotId === next.slotId) return
  if (next.slotId === null) await tx.enrollment.delete({ where: key })
  else if (prev.slotId === null) {
    await tx.enrollment.create({
      data: { examId, studentNumber: next.studentNumber, slotId: next.slotId },
    })
  } else await tx.enrollment.update({ where: key, data: { slotId: next.slotId } })
}

type CommandResult = Result<{ inverse: BoardCommand }>

export async function runBoardCommand(
  examId: string,
  ownerId: string,
  command: BoardCommand,
): Promise<CommandResult> {
  const result = await withExamLock(examId, ownerId, async (tx): Promise<CommandResult> => {
    const before = await loadBoardState(tx, examId)
    const applied = applyCommand(before, command)
    if (!applied.ok) return applied
    const old = new Map(before.people.map((p) => [p.studentNumber, p]))
    await Promise.all(
      changedPeople(before, applied.state).map((p) =>
        savePerson(tx, examId, old.get(p.studentNumber)!, p),
      ),
    )
    return { ok: true, inverse: applied.inverse }
  })
  return result ?? { ok: false, code: "NOT_FOUND" }
}
