import { isAPIError } from "better-auth/api"
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
import { blockedTeachersOnly, taughtBy } from "./exam-access.server.ts"
import { removeExam } from "./exam-ops.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

/** `createUser` sam sprawdza e-mail (APIError); przy wyścigu dwóch zapytań zostaje P2002. */
const isEmailTaken = (e: unknown) =>
  isUniqueViolation(e) ||
  (isAPIError(e) && e.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")

/** Powtarza middleware `requireAdmin`, żeby odmowę dało się sprawdzić testem każdej operacji. */
async function assertAdmin(headers: Headers) {
  const user = await sessionUser(headers)
  if (!user?.isAdmin) throw new Error(ACCESS_DENIED)
  return user
}

export async function accountList(headers: Headers) {
  await assertAdmin(headers)
  return db.user.findMany({
    where: { OR: [{ role: null }, { role: { not: STUDENT_ROLE } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, banned: true },
  })
}

export async function addAccount(
  headers: Headers,
  data: z.infer<typeof createAccountSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  try {
    // Zweryfikowany adres: link logowania studenta nie może skasować konta prowadzącego.
    await auth.api.createUser({ body: { ...data, role: "user", data: { emailVerified: true } } })
    return { ok: true }
  } catch (e) {
    if (isEmailTaken(e)) return { ok: false, code: "EMAIL_TAKEN" }
    throw e
  }
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

/** Zaliczenia zablokowanego konta (SPEC: superadmin cudzych zaliczeń nie widzi — poza tym wyjątkiem). */
export async function listBlockedAccountExams(headers: Headers, userId: string) {
  await assertAdmin(headers)
  const exams = await db.exam.findMany({
    where: { AND: [taughtBy(userId), blockedTeachersOnly] },
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
  return removeExam(examId, "blocked", confirmName)
}
