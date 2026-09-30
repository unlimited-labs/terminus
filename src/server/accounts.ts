import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { Prisma } from "../generated/prisma/client.ts"
import type { Result } from "../messages.pl.ts"
import {
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  setPasswordSchema,
  updateAccountSchema,
} from "../schemas/account.ts"

import { auth } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { requireAdmin } from "./session.ts"

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

export const listAccounts = createServerFn()
  .middleware([requireAdmin])
  .handler(() =>
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, banned: true },
    }),
  )

export const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts"], queryFn: () => listAccounts() })

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createAccountSchema)
  .handler(async ({ data }): Promise<Result> => {
    if (await db.user.findUnique({ where: { email: data.email } })) {
      return { ok: false, code: "EMAIL_TAKEN" }
    }
    await auth.api.createUser({ body: { ...data, role: "user" } })
    return { ok: true }
  })

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(updateAccountSchema)
  .handler(async ({ data: { userId, email, name } }): Promise<Result> => {
    try {
      await db.user.update({ where: { id: userId }, data: { email, name } })
      return { ok: true }
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: false, code: "EMAIL_TAKEN" }
      throw e
    }
  })

/** Nowe hasło wylogowuje wszystkie sesje tej osoby. */
export const setAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setPasswordSchema)
  .handler(async ({ data }): Promise<Result> => {
    const ctx = await auth.$context
    await ctx.internalAdapter.updatePassword(data.userId, await ctx.password.hash(data.password))
    await ctx.internalAdapter.deleteUserSessions(data.userId)
    return { ok: true }
  })

export const setAccountBanned = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setBannedSchema)
  .handler(async ({ data, context }): Promise<Result> => {
    if (data.userId === context.user.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
    const headers = getRequestHeaders()
    await (data.banned
      ? auth.api.banUser({ body: { userId: data.userId }, headers })
      : auth.api.unbanUser({ body: { userId: data.userId }, headers }))
    return { ok: true }
  })

export const setAccountAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setAdminSchema)
  .handler(async ({ data, context }): Promise<Result> => {
    if (data.userId === context.user.id) return { ok: false, code: "CANNOT_CHANGE_SELF" }
    await auth.api.setRole({
      body: { userId: data.userId, role: data.isAdmin ? "admin" : "user" },
      headers: getRequestHeaders(),
    })
    return { ok: true }
  })
