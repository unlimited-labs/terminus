import { randomUUID } from "node:crypto"

import { beforeEach, expect, test, vi } from "vitest"

import {
  accountList,
  addAccount,
  deleteBlockedAccountExam,
  setAdmin,
  setBanned,
  editAccount,
  listBlockedAccountExams,
  resetAccountTwoFactor,
  sendAccountPasswordLink,
} from "@/server/account-ops.server"
import { ACCESS_DENIED } from "@/messages.pl"
import { sessionUser } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { sendMail } from "@/server/mail.server"

import { createExam, enroll, inDays } from "./fixtures"
import { account, signIn } from "./sessions"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

const sent = vi.mocked(sendMail)
beforeEach(() => sent.mockReset())

const studentRow = () =>
  db.user.create({
    data: { id: randomUUID(), name: "", email: `${randomUUID()}@s.example.com`, role: "student" },
  })

const row = (id: string) =>
  db.user.findUniqueOrThrow({ where: { id }, select: { email: true, role: true, banned: true } })

test("bez roli superadmina każda operacja jest odrzucona i niczego nie zmienia", async () => {
  const target = await account()
  const before = await row(target.id)
  const users = await db.user.count()

  for (const headers of [(await account()).headers, new Headers()]) {
    await expect(accountList(headers)).rejects.toThrow(ACCESS_DENIED)
    const email = `${randomUUID()}@example.com`
    await expect(addAccount(headers, { email, name: "X" })).rejects.toThrow(ACCESS_DENIED)
    await expect(editAccount(headers, { userId: target.id, email, name: "X" })).rejects.toThrow(
      ACCESS_DENIED,
    )
    await expect(sendAccountPasswordLink(headers, { userId: target.id })).rejects.toThrow(
      ACCESS_DENIED,
    )
    await expect(resetAccountTwoFactor(headers, { userId: target.id })).rejects.toThrow(
      ACCESS_DENIED,
    )
    await expect(setBanned(headers, { userId: target.id, banned: true })).rejects.toThrow(
      ACCESS_DENIED,
    )
    await expect(setAdmin(headers, { userId: target.id, isAdmin: true })).rejects.toThrow(
      ACCESS_DENIED,
    )
  }
  expect(await row(target.id)).toEqual(before)
  expect(await db.user.count()).toBe(users + 1)
  expect(await sessionUser(target.headers)).toMatchObject({ id: target.id })
  expect(await sessionUser(await signIn(target.email))).toMatchObject({ id: target.id })
  expect(sent).not.toHaveBeenCalled()
})

test("superadmin zaprasza i poprawia konta; zajęty e-mail odrzucony", async () => {
  const admin = await account("admin")
  const other = await account()
  const email = `${randomUUID()}@example.com`

  expect(await addAccount(admin.headers, { email, name: "Nowy" })).toEqual({ ok: true })
  expect(sent).toHaveBeenCalledWith(
    expect.objectContaining({ to: email, subject: "Zaproszenie do Terminusa" }),
  )
  expect(await addAccount(admin.headers, { email, name: "Drugi" })).toEqual({
    ok: false,
    code: "EMAIL_TAKEN",
  })
  const invited = await db.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } })
  expect(invited).toMatchObject({ role: "user", emailVerified: true, accounts: [] })
  expect((await accountList(admin.headers)).find((a) => a.email === email)).toMatchObject({
    state: "invited",
    linkExpiresAt: expect.any(Date),
  })

  expect(await editAccount(admin.headers, { userId: other.id, email, name: "Y" })).toEqual({
    ok: false,
    code: "EMAIL_TAKEN",
  })
  const renamed = `${randomUUID()}@example.com`
  expect(
    await editAccount(admin.headers, { userId: other.id, email: renamed, name: "Inna" }),
  ).toEqual({ ok: true })
  expect(await row(other.id)).toMatchObject({ email: renamed })

  const moved = `${randomUUID()}@example.com`
  await editAccount(admin.headers, { userId: invited.id, email: moved, name: "Nowy" })
  expect((await accountList(admin.headers)).find((a) => a.email === moved)).toMatchObject({
    linkExpiresAt: null,
  })
})

test("równoczesne konta z tym samym e-mailem: jedno powstaje, reszta EMAIL_TAKEN", async () => {
  const admin = await account("admin")
  const email = `${randomUUID()}@example.com`
  const names = ["A", "B", "C", "D"]
  // Rozgrzane połączenia z puli, żeby zapytania naprawdę szły równolegle.
  await Promise.all(names.map(() => sessionUser(admin.headers)))
  const results = await Promise.all(names.map((name) => addAccount(admin.headers, { email, name })))
  const taken = { ok: false, code: "EMAIL_TAKEN" }
  expect(results.filter((r) => r.ok)).toEqual([{ ok: true }])
  expect(results.filter((r) => !r.ok)).toEqual([taken, taken, taken])
  expect(await db.user.count({ where: { email } })).toBe(1)
})

test("superadmin nie zablokuje siebie ani nie odbierze sobie roli; innym tak", async () => {
  const admin = await account("admin")
  const other = await account()
  const self = { code: "CANNOT_CHANGE_SELF", ok: false }

  expect(await setBanned(admin.headers, { userId: admin.id, banned: true })).toEqual(self)
  expect(await setAdmin(admin.headers, { userId: admin.id, isAdmin: false })).toEqual(self)
  expect(await row(admin.id)).toMatchObject({ role: "admin", banned: false })

  expect(await setAdmin(admin.headers, { userId: other.id, isAdmin: true })).toEqual({ ok: true })
  expect(await row(other.id)).toMatchObject({ role: "admin" })
  expect(await setAdmin(admin.headers, { userId: other.id, isAdmin: false })).toEqual({ ok: true })
  expect(await row(other.id)).toMatchObject({ role: "user" })

  await sendAccountPasswordLink(admin.headers, { userId: other.id })
  expect(await setBanned(admin.headers, { userId: other.id, banned: true })).toEqual({ ok: true })
  expect((await accountList(admin.headers)).find((a) => a.id === other.id)).toMatchObject({
    linkExpiresAt: null,
  })
  expect(
    await editAccount(admin.headers, {
      userId: (await studentRow()).id,
      email: `${randomUUID()}@example.com`,
      name: "S",
    }),
  ).toEqual({ ok: false, code: "NOT_FOUND" })
  expect(await row(other.id)).toMatchObject({ banned: true })
  expect(await sessionUser(other.headers)).toBeNull()
  await expect(signIn(other.email)).rejects.toThrow("You have been banned")
  expect(await setBanned(admin.headers, { userId: other.id, banned: false })).toEqual({ ok: true })
  expect(await sessionUser(await signIn(other.email))).toMatchObject({ id: other.id })
})

test("błąd poczty przy zaproszeniu: konto zostaje, panel dostaje MAIL_FAILED", async () => {
  const admin = await account("admin")
  const email = `${randomUUID()}@example.com`
  sent.mockRejectedValueOnce(new Error("SMTP"))
  expect(await addAccount(admin.headers, { email, name: "Nowy" })).toEqual({
    ok: false,
    code: "MAIL_FAILED",
  })
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  expect(await sendAccountPasswordLink(admin.headers, { userId: user.id })).toEqual({ ok: true })
})

test("link do zmiany hasła niczego nie zmienia do użycia; reset 2FA czyści składniki i sesje", async () => {
  const admin = await account("admin")
  const other = await account()
  const session = other.headers
  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier: `trust-device-${randomUUID()}`,
      value: other.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })

  expect(await sendAccountPasswordLink(admin.headers, { userId: other.id })).toEqual({ ok: true })
  expect(sent.mock.calls.at(-1)![0].subject).toBe("Zmiana hasła w Terminusie")
  expect(await sessionUser(session)).toMatchObject({ id: other.id })

  expect(await resetAccountTwoFactor(admin.headers, { userId: admin.id })).toEqual({
    ok: false,
    code: "CANNOT_CHANGE_SELF",
  })
  expect(await resetAccountTwoFactor(admin.headers, { userId: other.id })).toEqual({ ok: true })
  expect(await sessionUser(session)).toBeNull()
  expect(await db.user.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({
    twoFactorEnabled: false,
  })
  expect(await db.twoFactor.count({ where: { userId: other.id } })).toBe(0)
  expect(
    await db.verification.count({
      where: { value: other.id, identifier: { startsWith: "trust-device-" } },
    }),
  ).toBe(0)
  expect((await accountList(admin.headers)).find((a) => a.id === other.id)).toMatchObject({
    state: "no2fa",
  })
})

test("zablokowane konto z żywą sesją nie jest zalogowanym prowadzącym", async () => {
  const user = await account()
  expect(await sessionUser(user.headers)).toMatchObject({ id: user.id, isAdmin: false })
  await db.user.update({ where: { id: user.id }, data: { banned: true } })
  expect(await sessionUser(user.headers)).toBeNull()
})

test("zaliczenia zablokowanego konta: superadmin widzi je i usuwa; aktywnego konta — nie", async () => {
  const admin = await account("admin")
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
  })
  await enroll(examId, ["1"])
  const remove = (confirmName = "Kolokwium") =>
    deleteBlockedAccountExam(admin.headers, { examId, confirmName })

  expect(await listBlockedAccountExams(admin.headers, teacherId)).toEqual([])
  expect(await remove()).toEqual({ ok: false, code: "NOT_FOUND" })

  await db.user.update({ where: { id: teacherId }, data: { banned: true } })
  expect(await listBlockedAccountExams(admin.headers, teacherId)).toEqual([
    { id: examId, name: "Kolokwium", enrollments: 1 },
  ])
  await expect(listBlockedAccountExams((await account()).headers, teacherId)).rejects.toThrow(
    ACCESS_DENIED,
  )
  await expect(
    deleteBlockedAccountExam((await account()).headers, { examId, confirmName: "Kolokwium" }),
  ).rejects.toThrow(ACCESS_DENIED)
  expect(await remove("Inna nazwa")).toEqual({ ok: false, code: "NAME_MISMATCH" })
  expect(await remove()).toEqual({ ok: true })
  expect(await db.exam.count({ where: { id: examId } })).toBe(0)
})
