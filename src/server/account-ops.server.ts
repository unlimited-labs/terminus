import type { z } from "zod"

import { Prisma } from "../generated/prisma/client.ts"
import { ACCESS_DENIED, type Result } from "../messages.pl.ts"
import type {
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  setPasswordSchema,
  updateAccountSchema,
} from "../schemas/account.ts"
import type { deleteExamSchema } from "../schemas/exam.ts"

import { auth, replacePassword, sessionUser } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { removeExam } from "./exam-ops.server.ts"

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

/** Powtarza middleware `requireAdmin`, żeby odmowę dało się sprawdzić testem każdej operacji. */
async function assertAdmin(headers: Headers) {
  const user = await sessionUser(headers)
  if (!user?.isAdmin) throw new Error(ACCESS_DENIED)
  return user
}

export async function addAccount(
  headers: Headers,
  data: z.infer<typeof createAccountSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  if (await db.user.findUnique({ where: { email: data.email } })) {
    return { ok: false, code: "EMAIL_TAKEN" }
  }
  await auth.api.createUser({ body: { ...data, role: "user" } })
  return { ok: true }
}

export async function editAccount(
  headers: Headers,
  { userId, email, name }: z.infer<typeof updateAccountSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  try {
    await db.user.update({ where: { id: userId }, data: { email, name } })
    return { ok: true }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, code: "EMAIL_TAKEN" }
    throw e
  }
}

/** Nowe hasło wylogowuje wszystkie sesje tej osoby. */
export async function setPassword(
  headers: Headers,
  { userId, password }: z.infer<typeof setPasswordSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  await replacePassword(userId, password)
  return { ok: true }
}

export async function setBanned(
  headers: Headers,
  { userId, banned }: z.infer<typeof setBannedSchema>,
): Promise<Result> {
  const admin = await assertAdmin(headers)
  if (userId === admin.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
  await (banned
    ? auth.api.banUser({ body: { userId }, headers })
    : auth.api.unbanUser({ body: { userId }, headers }))
  return { ok: true }
}

export async function setAdmin(
  headers: Headers,
  { userId, isAdmin }: z.infer<typeof setAdminSchema>,
): Promise<Result> {
  const admin = await assertAdmin(headers)
  if (userId === admin.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
  await auth.api.setRole({ body: { userId, role: isAdmin ? "admin" : "user" }, headers })
  return { ok: true }
}

/** Zaliczenia, w których wszyscy prowadzący są zablokowani, a to konto jest jednym z nich. */
const orphanedExam = { teachers: { every: { banned: true } } }

/** Zaliczenia zablokowanego konta (SPEC: superadmin cudzych zaliczeń nie widzi — poza tym wyjątkiem). */
export async function listBlockedAccountExams(headers: Headers, userId: string) {
  await assertAdmin(headers)
  const exams = await db.exam.findMany({
    where: { AND: [{ teachers: { some: { id: userId } } }, orphanedExam] },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, _count: { select: { enrollments: true } } },
  })
  return exams.map(({ _count, ...exam }) => ({ ...exam, enrollments: _count.enrollments }))
}

/** Usunięcie zaliczenia samych zablokowanych kont; z aktywnym prowadzącym = nie znaleziono. */
export async function deleteBlockedAccountExam(
  headers: Headers,
  { examId, confirmName }: z.infer<typeof deleteExamSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  const exam = await db.exam.findFirst({
    where: { id: examId, ...orphanedExam },
    select: { teachers: { select: { id: true }, take: 1 } },
  })
  const teacherId = exam?.teachers[0]?.id
  if (!teacherId) return { ok: false, code: "NOT_FOUND" }
  return removeExam(examId, teacherId, confirmName)
}
