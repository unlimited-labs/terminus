import type { Prisma } from "../generated/prisma/client.ts"

import { db } from "./db.server.ts"

export type Tx = Prisma.TransactionClient

/**
 * Transakcja pod blokadą wiersza zaliczenia (`SELECT … FOR UPDATE`): zmiany jednego zaliczenia
 * wykonują się po kolei. Z `ownerId` cudze zaliczenie wygląda jak nieistniejące.
 * `null` = nie znaleziono.
 */
export function withExamLock<T>(
  examId: string,
  ownerId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T | null> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM exam
        WHERE id = ${examId} AND (${ownerId}::text IS NULL OR "ownerId" = ${ownerId})
        FOR UPDATE`
      return rows.length === 0 ? null : fn(tx)
    },
    { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 10_000 },
  )
}
