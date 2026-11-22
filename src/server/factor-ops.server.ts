import { isAPIError } from "better-auth/api"

import type { Result } from "../messages.pl.ts"

import { auth, deleteTrustedDevices } from "./auth.server.ts"
import { db } from "./db.server.ts"
import type { Tx } from "./exam-access.server.ts"

/**
 * Sprawdzenie „zostaje inny sposób” i usunięcie w jednej transakcji z blokadą wiersza konta: dwa
 * równoczesne usunięcia nie zostawią konta bez 2FA (powrót do „bez 2FA” tylko przez superadmina).
 */
function withFactorsLocked(
  userId: string,
  fn: (tx: Tx, totp: boolean, passkeys: number) => Promise<Result>,
) {
  return db.$transaction(async (tx): Promise<Result> => {
    const [user] = await tx.$queryRaw<{ twoFactorEnabled: boolean | null }[]>`
      SELECT "twoFactorEnabled" FROM "user" WHERE id = ${userId} FOR UPDATE`
    if (!user) return { ok: false, code: "NOT_FOUND" }
    // Liczenie dopiero po blokadzie: równoległe usunięcie czeka i zobaczy wynik tego.
    const passkeys = await tx.passkey.count({ where: { userId } })
    return fn(tx, user.twoFactorEnabled === true, passkeys)
  })
}

export function removePasskey(userId: string, passkeyId: string): Promise<Result> {
  return withFactorsLocked(userId, async (tx, totp, passkeys) => {
    if (passkeys - 1 + Number(totp) < 1) return { ok: false, code: "LAST_FACTOR" }
    const { count } = await tx.passkey.deleteMany({ where: { id: passkeyId, userId } })
    return count ? { ok: true } : { ok: false, code: "NOT_FOUND" }
  })
}

/** Odłączenie aplikacji z kodami (jak `/two-factor/disable` Better Auth): hasło, sekret, kody, zaufane przeglądarki. */
export async function disableTotp(
  headers: Headers,
  userId: string,
  password: string,
): Promise<Result> {
  try {
    await auth.api.verifyPassword({ body: { password }, headers })
  } catch (e) {
    if (isAPIError(e)) return { ok: false, code: "INVALID_PASSWORD" }
    throw e
  }
  return withFactorsLocked(userId, async (tx, _totp, passkeys) => {
    if (passkeys < 1) return { ok: false, code: "LAST_FACTOR" }
    await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } })
    await tx.twoFactor.deleteMany({ where: { userId } })
    await deleteTrustedDevices(userId, tx)
    return { ok: true }
  })
}
