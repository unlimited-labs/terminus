import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { passkey } from "@better-auth/passkey"
import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api"
import { consola } from "consola"
import { setSessionCookie } from "better-auth/cookies"
import { admin, jwt, magicLink, twoFactor } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { LOGIN_LINK_MINUTES } from "../domain/limits.ts"
import { AUTH_CODE, loginMail } from "../messages.pl.ts"

import { db } from "./db.server.ts"
import { env } from "./env.server.ts"
import { sendMail } from "./mail.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

const adminPlugin = admin()
const APP_URL = new URL(env.APP_PUBLIC_URL)
/** Adres serwera MCP; tokeny agentów są wydawane tylko na niego (`aud`). */
export const MCP_RESOURCE = `${APP_URL.origin}/mcp`
/** `iss` tokenów agentów (`jwt.issuer`); serwer MCP sprawdza ten sam. */
export const MCP_ISSUER = APP_URL.origin

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

/** Zmiana hasła w `/haslo` wylogowuje pozostałe sesje, więc odcina też agentów. */
const agentCutoffOnPasswordChange = {
  id: "agent-cutoff-on-password-change",
  hooks: {
    after: [
      {
        matcher: (ctx: { path?: string }) => ctx.path === "/change-password",
        handler: createAuthMiddleware(async (ctx) => {
          const userId = ctx.context.session?.user.id
          if (userId && ctx.body?.revokeOtherSessions && !isAPIError(ctx.context.returned))
            await disconnectAgents(userId)
        }),
      },
    ],
  },
}

const refuse = (code: keyof typeof AUTH_CODE) =>
  new APIError("FORBIDDEN", { code, message: AUTH_CODE[code] })

/** TOTP włączone (pole wtyczki `twoFactor` na wierszu `user`, typy hooków go nie znają). */
const totpOn = (user: object | null | undefined) =>
  !!user && "twoFactorEnabled" in user && user.twoFactorEnabled === true

const hasPasskey = async (userId: string) =>
  !!(await db.passkey.findFirst({ where: { userId }, select: { id: true } }))

/** Zaufane przeglądarki konta (pomijanie kodu TOTP przez 30 dni). */
export const deleteTrustedDevices = (userId: string, tx: Pick<typeof db, "verification"> = db) =>
  tx.verification.deleteMany({
    where: { identifier: { startsWith: "trust-device-" }, value: userId },
  })

const agentDisconnects = (userId: string, clientId?: string) => {
  const where = { userId, clientId }
  return [
    db.oauthAccessToken.deleteMany({ where }),
    db.oauthRefreshToken.deleteMany({ where }),
    db.oauthConsent.deleteMany({ where }),
  ]
}

/**
 * Odcięcie agentów AI konta (zgoda i tokeny; z `clientId` — jednego klienta). Wołane wprost tam, gdzie
 * kasujemy wszystkie sesje: hooki Better Auth nie ruszają refresh tokenów z `offline_access`.
 */
export const disconnectAgents = (userId: string, clientId?: string) =>
  db.$transaction(agentDisconnects(userId, clientId))

/** Student nie rejestruje klucza dostępu ani TOTP (2FA jest dla prowadzących). */
const teachersOnlyFactors = {
  id: "teachers-only-factors",
  hooks: {
    before: [
      {
        matcher: (ctx: { path?: string }) =>
          !!ctx.path && (ctx.path.startsWith("/passkey/") || ctx.path.startsWith("/two-factor/")),
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx)
          if (roleOf(session?.user) === STUDENT_ROLE) throw refuse("TEACHERS_ONLY")
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
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await Promise.all([deleteTrustedDevices(user.id), disconnectAgents(user.id)])
    },
  },
  logger: { log: (level, message, ...args) => consola[level](`auth ${message}`, ...args) },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  // Panel kont woła auth.api po stronie serwera; przez HTTP nikt nie podszyje się ani nie usunie konta.
  // Link wysyła wyłącznie `requestLink` (ograniczenia i jednakowa odpowiedź), a weryfikuje strona wejścia.
  // Link do hasła zakłada i wysyła `password-link.server.ts` (limity, jednakowa odpowiedź); OTP mailem wyłączone.
  disabledPaths: [
    ...Object.values(adminPlugin.endpoints).map((e) => e.path),
    "/sign-in/magic-link",
    MAGIC_LINK_PATH,
    "/request-password-reset",
    "/reset-password/:token",
    "/two-factor/send-otp",
    "/two-factor/verify-otp",
    // Usuwanie sposobów robi `factor-ops.server.ts` (blokada wiersza: nie da się usunąć ostatniego).
    "/passkey/delete-passkey",
    "/two-factor/disable",
    // JWT sesji nie wydajemy; wtyczka `jwt` jest tylko po to, by `mcp()` podpisywał access tokeny.
    "/token",
    // Nazwisko prowadzącego zmienia tylko superadmin (`editAccount`); imiona studentów są z listy indeksów.
    "/update-user",
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
              if (!totpOn(user) && (await hasPasskey(session.userId))) throw refuse("PASSKEY_ONLY")
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
    jwt({ disableSettingJwtHeader: true, jwt: { issuer: MCP_ISSUER } }),
    mcp({
      loginPage: "/login",
      consentPage: "/zgoda",
      resource: MCP_RESOURCE,
      // Prisma nie zapisze `allowedScopes: null` („bez ograniczeń”), więc jawnie domyślne zakresy.
      resources: [
        {
          identifier: MCP_RESOURCE,
          allowedScopes: ["openid", "profile", "email", "offline_access"],
        },
      ],
      grantTypes: ["authorization_code", "refresh_token"],
      // Klientów rejestruje tylko CIMD; domyślnie każdy zalogowany (także student) mógłby ich zakładać.
      clientPrivileges: () => false,
      postLogin: {
        page: "/konfiguracja-2fa",
        consentReferenceId: () => undefined,
        shouldRedirect: async ({ user }) => {
          if (roleOf(user) === STUDENT_ROLE) throw refuse("MCP_TEACHERS_ONLY")
          return !(totpOn(user) || (await hasPasskey(user.id)))
        },
      },
      // Przy wydaniu i odświeżeniu tokenu: konto mogło zostać zablokowane albo stracić 2FA.
      customAccessTokenClaims: async ({ user }) => {
        if (!user || !(await teacherById(user.id))) throw refuse("MCP_TEACHERS_ONLY")
        return {}
      },
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    teachersOnlyFactors,
    studentSession,
    agentCutoffOnPasswordChange,
    tanstackStartCookies(),
  ],
})

/** Prowadzący z sesją, także bez skonfigurowanego 2FA (ekran konfiguracji); zablokowany i student = brak. */
export async function signedInTeacher(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  return session ? teacherOf(session.user) : null
}

async function teacherOf(user: {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
  twoFactorEnabled?: boolean | null
}) {
  if (user.banned || user.role === STUDENT_ROLE) return null
  const { id, name, email, role } = user
  const totp = totpOn(user)
  return {
    id,
    name,
    email,
    isAdmin: role === "admin",
    totp,
    twoFactorReady: totp || (await hasPasskey(id)),
  }
}

/** Zalogowany prowadzący z gotowym 2FA; tylko on dostaje dane i operacje (bramka 2FA). */
export async function sessionUser(headers: Headers) {
  const user = await signedInTeacher(headers)
  return user?.twoFactorReady ? user : null
}

/** Jak `sessionUser`, ale konto z `sub` access tokenu MCP zamiast sesji przeglądarki. */
export async function teacherById(id: string) {
  const user = await db.user.findUnique({ where: { id } })
  const teacher = user && (await teacherOf(user))
  return teacher?.twoFactorReady ? teacher : null
}

/**
 * Reset 2FA (panel kont i `pnpm reset-2fa`): konto wraca do stanu „bez 2FA”, hasło zostaje, sesje
 * wylogowane, agenci odcięci.
 */
export async function resetTwoFactor(userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
    db.twoFactor.deleteMany({ where: { userId } }),
    db.passkey.deleteMany({ where: { userId } }),
    deleteTrustedDevices(userId),
    db.session.deleteMany({ where: { userId } }),
    ...agentDisconnects(userId),
  ])
}

/** Nowe hasło, wylogowanie wszystkich sesji tej osoby i odcięcie agentów (skrypt reset-password). */
export async function replacePassword(userId: string, password: string) {
  const ctx = await auth.$context
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password))
  await ctx.internalAdapter.deleteUserSessions(userId)
  await disconnectAgents(userId)
}
