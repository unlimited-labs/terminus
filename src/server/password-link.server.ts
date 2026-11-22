import { consola } from "consola"

import { takePasswordLinkAllowance } from "./attempt-limit.server.ts"
import { auth, failedPasswordMail } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { emailLoginAvailable } from "./env.server.ts"

/**
 * „Nie pamiętam hasła”: odpowiedź dla wywołującego zawsze ta sama, wysyłka nieczekana, żeby ani wynik,
 * ani czas nie zdradzały, czy konto istnieje. Kto nic nie dostaje (student, zablokowany), rozstrzyga
 * `sendResetPassword` w `auth.server.ts`. Log bez adresu.
 */
export async function requestPasswordLink(email: string, ip: string): Promise<void> {
  const trace = (result: string) => consola.info(`haslo ip=${ip} ${result}`)
  if (!emailLoginAvailable) return trace("wyłączone")
  if (!(await takePasswordLinkAllowance(ip, email))) return trace("limit")
  auth.api
    .requestPasswordReset({ body: { email } })
    .then(() => trace("obsłużone"))
    .catch(() => trace("błąd"))
}

/** Link do nadania hasła z panelu kont (zaproszenie, ponowna wysyłka, zmiana hasła); czekany. */
export async function sendPasswordLink(userId: string) {
  if (!emailLoginAvailable) return { ok: false as const, code: "MAIL_UNAVAILABLE" as const }
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })
  await auth.api.requestPasswordReset({ body: { email: user.email } })
  if (!failedPasswordMail.delete(userId)) return { ok: true as const }
  consola.error(`konto SMTP cel=${userId}`)
  return { ok: false as const, code: "MAIL_FAILED" as const }
}

/** Ważny link: do kogo i czy to zaproszenie (konto jeszcze bez hasła); `null` = wygasły, zużyty, błędny. */
export async function passwordLinkInfo(token: string) {
  const link = await db.verification.findFirst({
    where: { identifier: `reset-password:${token}`, expiresAt: { gt: new Date() } },
    select: { value: true },
  })
  if (!link) return null
  const user = await db.user.findUnique({
    where: { id: link.value },
    select: { name: true, email: true, accounts: { where: { providerId: "credential" } } },
  })
  return user && { name: user.name, email: user.email, invited: user.accounts.length === 0 }
}
