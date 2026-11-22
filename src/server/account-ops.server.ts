import { isAPIError } from "better-auth/api"
import { consola } from "consola"
import type { z } from "zod"

import { Prisma } from "../generated/prisma/client.ts"
import { ACCESS_DENIED, type Result } from "../messages.pl.ts"
import { accountState } from "../domain/account-state.ts"
import type {
  accountRefSchema,
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  updateAccountSchema,
} from "../schemas/account.ts"
import type { deleteExamSchema } from "../schemas/exam.ts"

import { auth, resetTwoFactor, sessionUser } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import { blockedTeachersOnly, taughtBy } from "./exam-access.server.ts"
import { removeExam } from "./exam-ops.server.ts"
import {
  deletePasswordLinks,
  passwordLinkExpiry,
  sendPasswordLink,
} from "./password-link.server.ts"
import { notStudent, passwordAccount } from "./roles.ts"

type AccountRef = z.infer<typeof accountRefSchema>

/** Ślad działań superadmina na kontach: identyfikatory, bez adresów. */
const logAction = (
  adminId: string,
  action: string,
  targetId: string,
  result: Result = { ok: true },
) =>
  consola.info(
    `konto admin=${adminId} akcja=${action} cel=${targetId} ${result.ok ? "ok" : result.code}`,
  )

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
  const [users, linkExpiry] = await Promise.all([
    db.user.findMany({
      where: notStudent,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        twoFactorEnabled: true,
        _count: { select: { passkeys: true, accounts: { where: passwordAccount } } },
      },
    }),
    passwordLinkExpiry(),
  ])
  return users.map(({ _count, twoFactorEnabled, ...user }) => ({
    ...user,
    state: accountState({
      banned: user.banned,
      hasPassword: _count.accounts > 0,
      twoFactorReady: twoFactorEnabled === true || _count.passkeys > 0,
    }),
    linkExpiresAt: linkExpiry.get(user.id) ?? null,
  }))
}

/** Zaproszenie: konto bez hasła i mail z linkiem; konto zostaje także przy błędzie wysyłki. */
export async function addAccount(
  headers: Headers,
  data: z.infer<typeof createAccountSchema>,
): Promise<Result> {
  if (!emailLoginAvailable) return { ok: false, code: "MAIL_UNAVAILABLE" }
  const admin = await assertAdmin(headers)
  let userId: string
  try {
    // Zweryfikowany adres: link logowania studenta nie może skasować konta prowadzącego.
    const { user } = await auth.api.createUser({
      body: { ...data, role: "user", data: { emailVerified: true } },
    })
    userId = user.id
  } catch (e) {
    if (isEmailTaken(e)) return { ok: false, code: "EMAIL_TAKEN" }
    throw e
  }
  const result = await sendPasswordLink(userId)
  logAction(admin.id, "zaproszenie", userId, result)
  return result
}

export async function editAccount(
  headers: Headers,
  { userId, email, name }: z.infer<typeof updateAccountSchema>,
): Promise<Result> {
  await assertAdmin(headers)
  try {
    const before = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    })
    await db.user.update({ where: { id: userId }, data: { email, name } })
    // Link wysłany na stary adres mógł trafić pod zły adres.
    if (before.email !== email) await deletePasswordLinks(userId)
    return { ok: true }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, code: "EMAIL_TAKEN" }
    throw e
  }
}

/** Ponowne zaproszenie albo link do zmiany hasła; do użycia linku nic się nie zmienia. */
export async function sendAccountPasswordLink(
  headers: Headers,
  { userId }: AccountRef,
): Promise<Result> {
  const admin = await assertAdmin(headers)
  const result = await sendPasswordLink(userId)
  logAction(admin.id, "link-hasla", userId, result)
  return result
}

export async function resetAccountTwoFactor(
  headers: Headers,
  { userId }: AccountRef,
): Promise<Result> {
  const admin = await assertAdmin(headers)
  if (userId === admin.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
  await resetTwoFactor(userId)
  logAction(admin.id, "reset-2fa", userId)
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
  logAction(admin.id, banned ? "blokada" : "odblokowanie", userId)
  return { ok: true }
}

export async function setAdmin(
  headers: Headers,
  { userId, isAdmin }: z.infer<typeof setAdminSchema>,
): Promise<Result> {
  const admin = await assertAdmin(headers)
  if (userId === admin.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
  await auth.api.setRole({ body: { userId, role: isAdmin ? "admin" : "user" }, headers })
  logAction(admin.id, isAdmin ? "nadanie-superadmina" : "odebranie-superadmina", userId)
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
