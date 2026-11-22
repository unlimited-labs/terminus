import { randomUUID } from "node:crypto"

import { beforeEach, expect, test, vi } from "vitest"

import { auth } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { sendMail } from "@/server/mail.server"
import {
  passwordLinkInfo,
  requestPasswordLink,
  sendPasswordLink,
} from "@/server/password-link.server"

import { account, signIn } from "./sessions"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

const sent = vi.mocked(sendMail)
beforeEach(() => sent.mockReset())

const tokenOf = (call: number) => {
  const link = new URL(/https?:\/\/\S+/.exec(sent.mock.calls.at(call)![0].text)![0])
  expect(link.pathname).toBe("/nowe-haslo")
  return link.searchParams.get("token")!
}

async function invited() {
  const email = `${randomUUID()}@example.com`
  const { user } = await auth.api.createUser({
    body: { email, name: "Nowa Osoba", role: "user", data: { emailVerified: true } },
  })
  return { id: user.id, email }
}

test("konto bez hasła dostaje zaproszenie; ponowna wysyłka unieważnia poprzedni link", async () => {
  const { id, email } = await invited()
  expect(await sendPasswordLink(id)).toEqual({ ok: true })
  expect(sent.mock.calls[0]![0]).toMatchObject({ to: email, subject: "Zaproszenie do Terminusa" })
  const first = tokenOf(0)
  expect(await passwordLinkInfo(first)).toEqual({ name: "Nowa Osoba", email, invited: true })

  await sendPasswordLink(id)
  expect(await passwordLinkInfo(first)).toBeNull()
  expect(await passwordLinkInfo(tokenOf(1))).toMatchObject({ invited: true })
})

test("nadanie hasła z linku zakłada hasło, wylogowuje sesje i czyści zaufane urządzenia", async () => {
  const { id, email, headers } = await account()
  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier: `trust-device-${randomUUID()}`,
      value: id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  await sendPasswordLink(id)
  expect(sent.mock.calls[0]![0].subject).toBe("Zmiana hasła w Terminusie")

  await auth.api.resetPassword({ body: { token: tokenOf(0), newPassword: "nowe-haslo-123" } })
  expect(await auth.api.getSession({ headers })).toBeNull()
  expect(
    await db.verification.count({
      where: { identifier: { startsWith: "trust-device-" }, value: id },
    }),
  ).toBe(0)
  expect(await signIn(email, "nowe-haslo-123")).toBeTruthy()
  await expect(
    auth.api.resetPassword({ body: { token: tokenOf(0), newPassword: "inne-haslo-123" } }),
  ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } })
})

test("student i konto zablokowane nie dostają linku; błąd poczty widać tylko w panelu", async () => {
  const student = await db.user.create({
    data: { id: randomUUID(), name: "", email: `${randomUUID()}@s.example.com`, role: "student" },
  })
  expect(await sendPasswordLink(student.id)).toEqual({ ok: true })
  const banned = await invited()
  await db.user.update({ where: { id: banned.id }, data: { banned: true } })
  await sendPasswordLink(banned.id)
  expect(sent).not.toHaveBeenCalled()

  const other = await invited()
  sent.mockRejectedValueOnce(new Error("SMTP"))
  expect(await sendPasswordLink(other.id)).toEqual({ ok: false, code: "MAIL_FAILED" })
})

test("„Nie pamiętam hasła”: trzy linki na godzinę na adres, nieznany adres bez maila", async () => {
  const { email } = await account()
  const ip = randomUUID()
  for (let i = 0; i < 4; i++) await requestPasswordLink(email, ip)
  await vi.waitFor(() => expect(sent).toHaveBeenCalledTimes(3))

  await requestPasswordLink(`${randomUUID()}@example.com`, randomUUID())
  await new Promise((r) => setTimeout(r, 200))
  expect(sent).toHaveBeenCalledTimes(3)
})
