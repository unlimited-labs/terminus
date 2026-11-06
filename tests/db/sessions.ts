import { randomUUID } from "node:crypto"

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
