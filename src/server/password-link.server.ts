import { randomBytes } from "node:crypto"

import { consola } from "consola"

import { PASSWORD_LINK_HOURS } from "../domain/limits.ts"
import { passwordMail } from "../messages.pl.ts"

import { takePasswordLinkAllowance } from "./attempt-limit.server.ts"
import { auth } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { emailLoginAvailable, env } from "./env.server.ts"
import { sendMail } from "./mail.server.ts"
import { smtpCode } from "./smtp-config.ts"
import { passwordAccount, STUDENT_ROLE, teacherWithEmail } from "./roles.ts"

/** Format wiersza `verification`, który czyta `POST /reset-password` Better Auth. */
const LINK_PREFIX = "reset-password:"

export const deletePasswordLinks = (userId: string) =>
  db.verification.deleteMany({ where: { identifier: { startsWith: LINK_PREFIX }, value: userId } })

/** Ważność żywego linku każdego konta, które go ma (najwyżej jeden na konto). */
export async function passwordLinkExpiry() {
  const links = await db.verification.findMany({
    where: { identifier: { startsWith: LINK_PREFIX }, expiresAt: { gt: new Date() } },
    select: { value: true, expiresAt: true },
  })
  return new Map(links.map((l) => [l.value, l.expiresAt]))
}

/**
 * Nowy link do nadania hasła (zaproszenie albo reset) i mail z nim; ważny jest tylko ostatni link konta.
 * Studentowi i zablokowanemu nie wysyła nic. Błąd poczty leci do wywołującego.
 */
async function issuePasswordLink(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      banned: true,
      accounts: { where: passwordAccount, select: { id: true } },
    },
  })
  if (user.role === STUDENT_ROLE || user.banned) return
  const token = randomBytes(18).toString("base64url")
  await deletePasswordLinks(userId)
  const ctx = await auth.$context
  await ctx.internalAdapter.createVerificationValue({
    identifier: `${LINK_PREFIX}${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + PASSWORD_LINK_HOURS * 3_600_000),
  })
  const link = new URL("/nowe-haslo", env.APP_PUBLIC_URL)
  link.searchParams.set("token", token)
  await sendMail({ to: user.email, ...passwordMail(link.toString(), user.accounts.length === 0) })
}

/**
 * „Nie pamiętam hasła”: odpowiedź dla wywołującego zawsze ta sama, wysyłka nieczekana, żeby ani wynik,
 * ani czas nie zdradzały, czy konto istnieje. Log bez adresu.
 */
export async function requestPasswordLink(email: string, ip: string): Promise<void> {
  const trace = (result: string) => consola.info(`haslo ip=${ip} ${result}`)
  if (!emailLoginAvailable) return trace("wyłączone")
  if (!(await takePasswordLinkAllowance(ip, email))) return trace("limit")
  const teacher = await db.user.findFirst({ where: teacherWithEmail(email), select: { id: true } })
  if (!teacher) return trace("nieznany")
  issuePasswordLink(teacher.id)
    .then(() => trace("wysłano"))
    .catch((e: unknown) => {
      trace("błąd")
      consola.error("haslo SMTP", smtpCode(e))
    })
}

/** Link do nadania hasła z panelu kont (zaproszenie, ponowna wysyłka, zmiana hasła); czekany. */
export async function sendPasswordLink(userId: string) {
  if (!emailLoginAvailable) return { ok: false as const, code: "MAIL_UNAVAILABLE" as const }
  try {
    await issuePasswordLink(userId)
    return { ok: true as const }
  } catch (e) {
    consola.error(`konto SMTP cel=${userId}`, smtpCode(e))
    return { ok: false as const, code: "MAIL_FAILED" as const }
  }
}

/** Ważny link: do kogo i czy to zaproszenie (konto jeszcze bez hasła); `null` = wygasły, zużyty, błędny. */
export async function passwordLinkInfo(token: string) {
  const link = await db.verification.findFirst({
    where: { identifier: `${LINK_PREFIX}${token}`, expiresAt: { gt: new Date() } },
    select: { value: true },
  })
  if (!link) return null
  const user = await db.user.findUnique({
    where: { id: link.value },
    select: { name: true, email: true, accounts: { where: passwordAccount, select: { id: true } } },
  })
  return user && { name: user.name, email: user.email, invited: user.accounts.length === 0 }
}
