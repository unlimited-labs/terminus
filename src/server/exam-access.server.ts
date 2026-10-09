import { Prisma } from "../generated/prisma/client.ts"

import { db } from "./db.server.ts"

export type Tx = Prisma.TransactionClient
type NotFound = { ok: false; code: "NOT_FOUND" }
type Busy = { ok: false; code: "BUSY" }

/** `"blocked"` (superadmin wobec zaliczenia samych zablokowanych kont) — dopiero po sprawdzeniu admina. */
export type ExamAccess = { teacher: string } | "public" | "blocked"

export const blockedTeachersOnly = { teachers: { every: { banned: true } } }

/** Zaliczenia, których konto jest prowadzącym. */
export const taughtBy = (userId: string) => ({ teachers: { some: { id: userId } } })

/** Jedyna reguła dostępu do zaliczenia. */
function examWhere(examId: string, access: ExamAccess): Prisma.ExamWhereInput {
  if (access === "public") return { id: examId }
  if (access === "blocked") return { id: examId, ...blockedTeachersOnly }
  return { id: examId, ...taughtBy(access.teacher) }
}

/** Odczyt zaliczenia prowadzącego bez blokady: cudze = nie znaleziono (`null`). */
export function getOwnedExam(examId: string, userId: string) {
  return db.exam.findFirst({ where: examWhere(examId, { teacher: userId }), select: { id: true } })
}

/** Czy lista należy do zaliczenia. */
export async function rosterInExam(tx: Tx, examId: string, rosterId: string) {
  return (await tx.roster.count({ where: { id: rosterId, examId } })) > 0
}

/**
 * Transakcja pod blokadą wiersza zaliczenia (`SELECT … FOR UPDATE`): zmiany jednego zaliczenia
 * wykonują się po kolei. Nieistniejące albo cudze zaliczenie = `NOT_FOUND` bez wywołania `fn`.
 * Limit czasu liczy się razem z czekaniem na blokadę; P2028 (pełna pula albo wygaśnięcie
 * w kolejce do blokady) = `BUSY`.
 */
export async function withExamLock<T>(
  examId: string,
  access: ExamAccess,
  fn: (tx: Tx) => Promise<T>,
  timeout = 10_000,
): Promise<T | NotFound | Busy> {
  try {
    return await db.$transaction(
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
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2028") {
      return { ok: false, code: "BUSY" }
    }
    throw e
  }
}
