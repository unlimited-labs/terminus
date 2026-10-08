import type { Prisma } from "../generated/prisma/client.ts"

import { db } from "./db.server.ts"

export type Tx = Prisma.TransactionClient
type NotFound = { ok: false; code: "NOT_FOUND" }

/** `"blocked"` (superadmin wobec zaliczenia samych zablokowanych kont) — dopiero po sprawdzeniu admina. */
export type ExamAccess = { teacher: string } | "public" | "blocked"

export const blockedTeachersOnly = { teachers: { every: { banned: true } } }

/** Jedyna reguła dostępu do zaliczenia. */
const examWhere = (examId: string, access: ExamAccess): Prisma.ExamWhereInput =>
  access === "public"
    ? { id: examId }
    : access === "blocked"
      ? { id: examId, ...blockedTeachersOnly }
      : { id: examId, teachers: { some: { id: access.teacher } } }

/** Odczyt zaliczenia prowadzącego bez blokady: cudze = nie znaleziono (`null`). */
export function getOwnedExam(examId: string, userId: string) {
  return db.exam.findFirst({ where: examWhere(examId, { teacher: userId }) })
}

/**
 * Transakcja pod blokadą wiersza zaliczenia (`SELECT … FOR UPDATE`): zmiany jednego zaliczenia
 * wykonują się po kolei. Nieistniejące albo cudze zaliczenie = `NOT_FOUND` bez wywołania `fn`.
 * Limit czasu liczy się razem z czekaniem na blokadę.
 */
export function withExamLock<T>(
  examId: string,
  access: ExamAccess,
  fn: (tx: Tx) => Promise<T>,
  timeout = 10_000,
): Promise<T | NotFound> {
  return db.$transaction(
    async (tx) => {
      const notFound = { ok: false as const, code: "NOT_FOUND" as const }
      const allowed = () => tx.exam.count({ where: examWhere(examId, access) })
      // Przed blokadą: cudzy prowadzący nie czeka w kolejce do cudzego zaliczenia. Po blokadzie
      // jeszcze raz, bo skład prowadzących zmienia się pod tą samą blokadą.
      if (!(await allowed())) return notFound
      const locked = await tx.$queryRaw<
        unknown[]
      >`SELECT 1 FROM exam WHERE id = ${examId} FOR UPDATE`
      return locked.length > 0 && (await allowed()) ? fn(tx) : notFound
    },
    { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout },
  )
}
