import { passkey } from "@better-auth/passkey"
import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { consola } from "consola"
import { setSessionCookie } from "better-auth/cookies"
import { admin, magicLink, twoFactor } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { LOGIN_LINK_MINUTES, PASSWORD_LINK_HOURS } from "../domain/limits.ts"
import { AUTH_CODE, loginMail, passwordMail } from "../messages.pl.ts"

import { db } from "./db.server.ts"
import { env } from "./env.server.ts"
import { sendMail } from "./mail.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

const adminPlugin = admin()
const APP_URL = new URL(env.APP_PUBLIC_URL)

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

const refuse = (code: keyof typeof AUTH_CODE) =>
  new APIError("FORBIDDEN", { code, message: AUTH_CODE[code] })

/** Klucze dostępu i TOTP konta; „skonfigurowane 2FA” = TOTP włączone albo co najmniej jeden klucz. */
async function factorsOf(userId: string) {
  const [user, passkeys] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } }),
    db.passkey.count({ where: { userId } }),
  ])
  const totp = user?.twoFactorEnabled === true
  return { totp, passkeys, ready: totp || passkeys > 0 }
}

/** Zaufane przeglądarki konta (pomijanie kodu TOTP przez 30 dni). */
const deleteTrustedDevices = (userId: string) =>
  db.verification.deleteMany({
    where: { identifier: { startsWith: "trust-device-" }, value: userId },
  })

/**
 * Strażnicy 2FA, których Better Auth nie ma: student nie rejestruje klucza ani TOTP, a ostatniego
 * sposobu potwierdzania nie da się usunąć (powrót do „bez 2FA” tylko przez superadmina).
 */
const teacherFactors = {
  id: "teacher-factors",
  hooks: {
    before: [
      {
        matcher: (ctx: { path?: string }) =>
          !!ctx.path && (ctx.path.startsWith("/passkey/") || ctx.path.startsWith("/two-factor/")),
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx)
          if (!session) return
          if (roleOf(session.user) === STUDENT_ROLE) throw refuse("TEACHERS_ONLY")
          const removing =
            ctx.path === "/passkey/delete-passkey" || ctx.path === "/two-factor/disable"
          if (!removing) return
          const { totp, passkeys } = await factorsOf(session.user.id)
          const left = ctx.path === "/two-factor/disable" ? passkeys : passkeys - 1 + Number(totp)
          if (left < 1) throw refuse("LAST_FACTOR")
        }),
      },
    ],
  },
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_PUBLIC_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  appName: "Terminus",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    resetPasswordTokenExpiresIn: PASSWORD_LINK_HOURS * 3600,
    revokeSessionsOnPasswordReset: true,
    // Zaproszenie i reset to ten sam link; ważny jest tylko ostatni. Student i zablokowany nie dostają nic.
    sendResetPassword: async ({ user, token }) => {
      if (roleOf(user) === STUDENT_ROLE || ("banned" in user && user.banned)) return
      await db.verification.deleteMany({
        where: {
          identifier: { startsWith: "reset-password:", not: `reset-password:${token}` },
          value: user.id,
        },
      })
      const invited = !(await db.account.count({
        where: { userId: user.id, providerId: "credential" },
      }))
      const link = new URL("/nowe-haslo", env.APP_PUBLIC_URL)
      link.searchParams.set("token", token)
      await sendMail({ to: user.email, ...passwordMail(link.toString(), invited) })
    },
    onPasswordReset: async ({ user }) => {
      await deleteTrustedDevices(user.id)
    },
  },
  logger: { log: (level, message, ...args) => consola[level](`auth ${message}`, ...args) },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  // Panel kont woła auth.api po stronie serwera; przez HTTP nikt nie podszyje się ani nie usunie konta.
  // Link wysyła wyłącznie `requestLink` (ograniczenia i jednakowa odpowiedź), a weryfikuje strona wejścia.
  // Link do hasła wysyła wyłącznie `password-link.server.ts` (limity, jednakowa odpowiedź); OTP mailem wyłączone.
  disabledPaths: [
    ...Object.values(adminPlugin.endpoints).map((e) => e.path),
    "/sign-in/magic-link",
    MAGIC_LINK_PATH,
    "/request-password-reset",
    "/reset-password/:token",
    "/two-factor/send-otp",
    "/two-factor/verify-otp",
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
            if (ctx?.path === MAGIC_LINK_PATH) return false
            // Hasło konta z samym kluczem dostępu nie wpuszcza (dopiero po poprawnym haśle, więc nic nie zdradza).
            if (ctx?.path === "/sign-in/email") {
              const { totp, passkeys } = await factorsOf(session.userId)
              if (!totp && passkeys > 0) throw refuse("PASSKEY_ONLY")
            }
            return undefined
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
    twoFactor({ issuer: "Terminus" }),
    passkey({
      rpID: APP_URL.hostname,
      rpName: "Terminus",
      origin: APP_URL.origin,
      // Logowanie przyciskiem bez e-maila wymaga klucza zapisanego na urządzeniu; sam klucz bez PIN-u nie wystarcza.
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    }),
    teacherFactors,
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
