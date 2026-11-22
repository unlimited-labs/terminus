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

export const signIn = async (email: string, password = TEST_PASSWORD) => {
  const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
  return cookiesOf(res.headers)
}

/** Konto z otwartą sesją; zwraca jego id, e-mail i nagłówki tej sesji. */
export async function account(role: "admin" | "user" = "user") {
  const email = `${randomUUID()}@example.com`
  const { user } = await auth.api.createUser({
    body: { email, password: TEST_PASSWORD, name: "Osoba", role },
  })
  return { id: user.id, email, headers: await signIn(email) }
}

/** Kod TOTP z adresu `otpauth://` (sekret w Base32, jak w kodzie QR). */
async function totpCode(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret")!
  return createOTP(base32.decode(secret)).totp()
}

/** Włącza TOTP na koncie z sesją `headers` (jak ekran konfiguracji); zwraca adres `otpauth://`. */
export async function enableTotp(headers: Headers) {
  const enabled = await auth.api.enableTwoFactor({
    body: { password: TEST_PASSWORD, method: "totp" },
    headers,
  })
  if (enabled.method !== "totp") throw new Error("oczekiwano TOTP")
  const { totpURI } = enabled
  await auth.api.verifyTOTP({ body: { code: await totpCode(totpURI) }, headers })
  return totpURI
}

/** Logowanie hasłem + kodem TOTP; nagłówki sesji. */
export async function signInWithTotp(email: string, totpURI: string) {
  const first = await auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    returnHeaders: true,
  })
  const res = await auth.api.verifyTOTP({
    body: { code: await totpCode(totpURI) },
    headers: cookiesOf(first.headers),
    returnHeaders: true,
  })
  return cookiesOf(res.headers)
}
