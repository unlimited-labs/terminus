import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { consola } from "consola"
import { setSessionCookie } from "better-auth/cookies"
import { admin, magicLink } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { LOGIN_LINK_MINUTES, loginMail } from "../messages.pl.ts"

import { db } from "./db.server.ts"
import { env } from "./env.server.ts"
import { sendMail } from "./mail.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

const adminPlugin = admin()

/** Typy hooków i wtyczek nie znają pola `role` z wtyczki admin. */
const roleOf = (user: object | null | undefined) =>
  user && "role" in user && typeof user.role === "string" ? user.role : null

const MAGIC_LINK_PATH = "/magic-link/verify"
const STUDENT_SESSION_MS = 24 * 60 * 60 * 1000

/**
 * Sesja studenta nie jest odnawiana i kończy się z zamknięciem przeglądarki: ciasteczko bez `Max-Age`
 * oraz znacznik `dont_remember`, po którym Better Auth pomija odnawianie. Robi to hook, bo wtyczka
 * linku ustawia ciasteczko jak dla prowadzących (7 dni).
 */
const studentSession = {
  id: "student-session",
  hooks: {
    after: [
      {
        matcher: (ctx: { path?: string }) => ctx.path === MAGIC_LINK_PATH,
        handler: createAuthMiddleware(async (ctx) => {
          const session = ctx.context.newSession
          if (session && roleOf(session.user) === STUDENT_ROLE)
            await setSessionCookie(ctx, session, true)
        }),
      },
    ],
  },
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_PUBLIC_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  logger: { log: (level, message, ...args) => consola[level](`auth ${message}`, ...args) },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  // Panel kont woła auth.api po stronie serwera; przez HTTP nikt nie podszyje się ani nie usunie konta.
  // Link wysyła wyłącznie `requestLink` (ograniczenia i jednakowa odpowiedź), a weryfikuje strona wejścia.
  disabledPaths: [
    ...Object.values(adminPlugin.endpoints).map((e) => e.path),
    "/sign-in/magic-link",
    MAGIC_LINK_PATH,
  ],
  databaseHooks: {
    user: {
      create: {
        // Konto założone linkiem to student, nigdy prowadzący (`defaultRole` wtyczki admin to `user`).
        before: async (_user, ctx) =>
          ctx?.path === MAGIC_LINK_PATH ? { data: { role: STUDENT_ROLE } } : undefined,
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          const user = await ctx?.context.internalAdapter.findUserById(session.userId)
          if (roleOf(user) !== STUDENT_ROLE) {
            // Konto prowadzącego, które powstało po wysłaniu linku, nie wchodzi tym linkiem.
            return ctx?.path === MAGIC_LINK_PATH ? false : undefined
          }
          return { data: { expiresAt: new Date(Date.now() + STUDENT_SESSION_MS) } }
        },
      },
    },
  },
  plugins: [
    adminPlugin,
    magicLink({
      expiresIn: LOGIN_LINK_MINUTES * 60,
      storeToken: "hashed",
      disableSignUp: false,
      // Własny adres (`url` wtyczki prowadzi do punktu, który jest wyłączony); `examId` w `metadata`.
      sendMagicLink: async ({ email, token, metadata }) => {
        const link = new URL(`/z/${String(metadata?.examId)}/enter`, env.APP_PUBLIC_URL)
        link.searchParams.set("token", token)
        await sendMail({ to: email, ...loginMail(link.toString()) })
      },
    }),
    studentSession,
    tanstackStartCookies(),
  ],
})

/** Zalogowany prowadzący z nagłówków żądania; zablokowane konto i student = brak. */
export async function sessionUser(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session || session.user.banned || session.user.role === STUDENT_ROLE) return null
  const { id, name, email, role } = session.user
  return { id, name, email, isAdmin: role === "admin" }
}

/** Nowe hasło i wylogowanie wszystkich sesji tej osoby (panel kont i skrypt reset-password). */
export async function replacePassword(userId: string, password: string) {
  const ctx = await auth.$context
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password))
  await ctx.internalAdapter.deleteUserSessions(userId)
}
