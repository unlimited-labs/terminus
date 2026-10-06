import type { Prisma } from "../generated/prisma/client.ts"

import { db } from "./db.server.ts"

export type Tx = Prisma.TransactionClient
type NotFound = { ok: false; code: "NOT_FOUND" }

/** Jedyna reguła własności: `ownerId` `null` = dostęp publiczny (zapis studenta). */
const ownsExam = (exam: { ownerId: string }, ownerId: string | null) =>
  ownerId === null || exam.ownerId === ownerId

/** Odczyt zaliczenia prowadzącego bez blokady: cudze = nie znaleziono (`null`). */
export async function getOwnedExam(examId: string, ownerId: string) {
  const exam = await db.exam.findUnique({ where: { id: examId } })
  return exam && ownsExam(exam, ownerId) ? exam : null
}

/**
 * Transakcja pod blokadą wiersza zaliczenia (`SELECT … FOR UPDATE`): zmiany jednego zaliczenia
 * wykonują się po kolei. Nieistniejące albo cudze zaliczenie = `NOT_FOUND` bez wywołania `fn`.
 * Limit czasu liczy się razem z czekaniem na blokadę.
 */
export function withExamLock<T>(
  examId: string,
  ownerId: string | null,
  fn: (tx: Tx) => Promise<T>,
  timeout = 10_000,
): Promise<T | NotFound> {
  return db.$transaction(
    async (tx) => {
      const [exam] = await tx.$queryRaw<{ ownerId: string }[]>`
        SELECT "ownerId" FROM exam WHERE id = ${examId} FOR UPDATE`
      return exam && ownsExam(exam, ownerId)
        ? fn(tx)
        : { ok: false as const, code: "NOT_FOUND" as const }
    },
    { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout },
  )
}
