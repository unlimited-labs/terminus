import type { z } from "zod"

import { Prisma } from "../generated/prisma/client.ts"
import type { Result } from "../messages.pl.ts"
import type {
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  setPasswordSchema,
  updateAccountSchema,
} from "../schemas/account.ts"

import { auth, sessionUser } from "./auth.server.ts"
import { db } from "./db.server.ts"

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

async function requireAdmin(headers: Headers) {
  const user = await sessionUser(headers)
  if (!user?.isAdmin) throw new Error("Brak dostępu")
  return user
}

export async function addAccount(
  headers: Headers,
  data: z.infer<typeof createAccountSchema>,
): Promise<Result> {
  await requireAdmin(headers)
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
  await requireAdmin(headers)
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
  await requireAdmin(headers)
  const ctx = await auth.$context
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password))
  await ctx.internalAdapter.deleteUserSessions(userId)
  return { ok: true }
}

export async function setBanned(
  headers: Headers,
  { userId, banned }: z.infer<typeof setBannedSchema>,
): Promise<Result> {
  const admin = await requireAdmin(headers)
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
  const admin = await requireAdmin(headers)
  if (userId === admin.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
  await auth.api.setRole({ body: { userId, role: isAdmin ? "admin" : "user" }, headers })
  return { ok: true }
}
