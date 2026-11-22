import { randomUUID } from "node:crypto"

import { base32 } from "@better-auth/utils/base32"
import { createOTP } from "@better-auth/utils/otp"

import { auth } from "@/server/auth.server"

export const TEST_PASSWORD = "haslo-123456"

/** Nagłówek `cookie` z ciasteczek ustawionych w odpowiedzi. */
export const cookiesOf = (headers: Headers) =>
  new Headers({
    cookie: headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  })

/** Adres `otpauth://` kont testowych z TOTP, żeby `signIn` sam podał kod. */
const totpOf = new Map<string, string>()

/** Kod TOTP z adresu `otpauth://` (sekret w Base32, jak w kodzie QR). */
async function totpCode(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret")!
  return createOTP(base32.decode(secret)).totp()
}

/** Logowanie hasłem; konto z TOTP dostaje od razu kod, jak w drugim kroku ekranu logowania. */
export async function signIn(email: string, password = TEST_PASSWORD) {
  const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
  const totpURI = totpOf.get(email)
  if (!("twoFactorRedirect" in res.response) || !totpURI) return cookiesOf(res.headers)
  const verified = await auth.api.verifyTOTP({
    body: { code: await totpCode(totpURI) },
    headers: cookiesOf(res.headers),
    returnHeaders: true,
  })
  return cookiesOf(verified.headers)
}

/** Włącza TOTP na koncie z sesją `headers` (jak ekran konfiguracji); zwraca adres `otpauth://`. */
export async function enableTotp(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  const enabled = await auth.api.enableTwoFactor({
    body: { password: TEST_PASSWORD, method: "totp" },
    headers,
  })
  if (enabled.method !== "totp") throw new Error("oczekiwano TOTP")
  await auth.api.verifyTOTP({ body: { code: await totpCode(enabled.totpURI) }, headers })
  if (session) totpOf.set(session.user.email, enabled.totpURI)
  return enabled.totpURI
}

/**
 * Konto z otwartą sesją; zwraca jego id, e-mail i nagłówki tej sesji. Domyślnie z włączonym TOTP
 * (bramka 2FA wpuszcza tylko takie); `twoFactor: false` = konto, które dopiero skonfiguruje 2FA.
 */
export async function account(role: "admin" | "user" = "user", { twoFactor = true } = {}) {
  const email = `${randomUUID()}@example.com`
  const { user } = await auth.api.createUser({
    body: { email, password: TEST_PASSWORD, name: "Osoba", role },
  })
  const first = await signIn(email)
  if (twoFactor) await enableTotp(first)
  return { id: user.id, email, headers: twoFactor ? await signIn(email) : first }
}
