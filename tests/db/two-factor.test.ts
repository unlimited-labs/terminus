import { randomUUID } from "node:crypto"

import { expect, test, vi } from "vitest"

import { auth, sessionUser, signedInTeacher } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { sendMail } from "@/server/mail.server"

import { account, cookiesOf, enableTotp, signIn, TEST_PASSWORD } from "./sessions"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

const addPasskey = (userId: string) =>
  db.passkey.create({
    data: {
      id: randomUUID(),
      userId,
      publicKey: "klucz",
      credentialID: randomUUID(),
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    },
  })

const signInBody = (email: string, password = TEST_PASSWORD) => ({
  body: { email, password },
  returnHeaders: true as const,
})

test("konto z TOTP: samo hasło nie daje sesji, hasło + kod daje", async () => {
  const { id, email, headers } = await account("user", { twoFactor: false })
  await enableTotp(headers)
  expect(await db.user.findUniqueOrThrow({ where: { id } })).toMatchObject({
    twoFactorEnabled: true,
  })

  const first = await auth.api.signInEmail(signInBody(email))
  expect(first.response).toMatchObject({ twoFactorRedirect: true })
  expect(await auth.api.getSession({ headers: cookiesOf(first.headers) })).toBeNull()

  const session = await auth.api.getSession({ headers: await signIn(email) })
  expect(session?.user.id).toBe(id)
})

test("konto z samym kluczem dostępu nie loguje się hasłem; złe hasło nie zdradza, że ma klucz", async () => {
  const { id, email } = await account("user", { twoFactor: false })
  await addPasskey(id)
  await expect(auth.api.signInEmail(signInBody(email))).rejects.toMatchObject({
    body: { code: "PASSKEY_ONLY" },
  })
  await expect(auth.api.signInEmail(signInBody(email, "zle-haslo-123"))).rejects.toMatchObject({
    body: { code: "INVALID_EMAIL_OR_PASSWORD" },
  })
  expect(await db.session.count({ where: { userId: id } })).toBe(1)
})

test("ostatniego sposobu potwierdzania nie da się usunąć", async () => {
  const { id, headers: session } = await account()
  const key = await addPasskey(id)

  await auth.api.deletePasskey({ body: { id: key.id }, headers: session })
  expect(await db.passkey.count({ where: { userId: id } })).toBe(0)
  await expect(
    auth.api.disableTwoFactor({ body: { password: TEST_PASSWORD }, headers: session }),
  ).rejects.toMatchObject({ body: { code: "LAST_FACTOR" } })

  const only = await addPasskey(id)
  const disabled = await auth.api.disableTwoFactor({
    body: { password: TEST_PASSWORD },
    headers: session,
    returnHeaders: true,
  })
  await expect(
    auth.api.deletePasskey({ body: { id: only.id }, headers: cookiesOf(disabled.headers) }),
  ).rejects.toMatchObject({ body: { code: "LAST_FACTOR" } })
})

test("student nie rejestruje klucza dostępu ani TOTP", async () => {
  const email = `${randomUUID()}@student.example.com`
  await auth.api.signInMagicLink({
    body: { email, metadata: { examId: "x" } },
    headers: new Headers(),
  })
  const text = vi.mocked(sendMail).mock.calls.at(-1)![0].text
  const token = new URL(/https?:\/\/\S+/.exec(text)![0]).searchParams.get("token")!
  const res = await auth.api.magicLinkVerify({
    query: { token },
    headers: new Headers(),
    asResponse: true,
  })
  const headers = cookiesOf(res.headers)

  await expect(auth.api.generatePasskeyRegistrationOptions({ headers })).rejects.toMatchObject({
    body: { code: "TEACHERS_ONLY" },
  })
  await expect(
    auth.api.enableTwoFactor({ body: { password: "cokolwiek" }, headers }),
  ).rejects.toMatchObject({ body: { code: "TEACHERS_ONLY" } })
})

test("bramka 2FA: konto bez drugiego sposobu ma sesję, ale nie dostaje danych", async () => {
  const { id, headers } = await account("user", { twoFactor: false })
  expect(await signedInTeacher(headers)).toMatchObject({ id, twoFactorReady: false })
  expect(await sessionUser(headers)).toBeNull()

  await enableTotp(headers)
  const { headers: ready } = await account()
  expect(await sessionUser(ready)).toMatchObject({ twoFactorReady: true, totp: true })
})
