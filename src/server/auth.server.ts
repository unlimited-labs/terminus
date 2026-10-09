import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { consola } from "consola"
import { admin } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { db } from "./db.server.ts"
import { env } from "./env.server.ts"

const adminPlugin = admin()

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_PUBLIC_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  logger: { log: (level, message, ...args) => consola[level](`auth ${message}`, ...args) },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  // Panel kont woła auth.api po stronie serwera; przez HTTP nikt nie podszyje się ani nie usunie konta.
  disabledPaths: Object.values(adminPlugin.endpoints).map((e) => e.path),
  plugins: [adminPlugin, tanstackStartCookies()],
})

/** Zalogowany prowadzący z nagłówków żądania; zablokowane konto = brak. */
export async function sessionUser(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session || session.user.banned) return null
  const { id, name, email, role } = session.user
  return { id, name, email, isAdmin: role === "admin" }
}

/** Nowe hasło i wylogowanie wszystkich sesji tej osoby (panel kont i skrypt reset-password). */
export async function replacePassword(userId: string, password: string) {
  const ctx = await auth.$context
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password))
  await ctx.internalAdapter.deleteUserSessions(userId)
}
