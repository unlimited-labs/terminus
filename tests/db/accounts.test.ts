import { randomUUID } from "node:crypto"

import { expect, test } from "vitest"

import {
  addAccount,
  setAdmin,
  setBanned,
  setPassword,
  editAccount,
} from "@/server/account-ops.server"
import { auth, sessionUser } from "@/server/auth.server"
import { db } from "@/server/db.server"

const password = "haslo-123456"

const signIn = async (email: string, pass = password) => {
  const res = await auth.api.signInEmail({ body: { email, password: pass }, returnHeaders: true })
  return new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  })
}

/** Konto z otwartą sesją; zwraca jego id, e-mail i nagłówki tej sesji. */
async function account(role: "admin" | "user" = "user") {
  const email = `${randomUUID()}@example.com`
  const { user } = await auth.api.createUser({ body: { email, password, name: "Osoba", role } })
  return { id: user.id, email, headers: await signIn(email) }
}

const row = (id: string) =>
  db.user.findUniqueOrThrow({ where: { id }, select: { email: true, role: true, banned: true } })

test("bez roli superadmina każda operacja jest odrzucona i niczego nie zmienia", async () => {
  const target = await account()
  const before = await row(target.id)
  const users = await db.user.count()

  for (const headers of [(await account()).headers, new Headers()]) {
    const email = `${randomUUID()}@example.com`
    await expect(addAccount(headers, { email, name: "X", password })).rejects.toThrow(
      "Brak dostępu",
    )
    await expect(editAccount(headers, { userId: target.id, email, name: "X" })).rejects.toThrow(
      "Brak dostępu",
    )
    await expect(
      setPassword(headers, { userId: target.id, password: "inne-haslo-1" }),
    ).rejects.toThrow("Brak dostępu")
    await expect(setBanned(headers, { userId: target.id, banned: true })).rejects.toThrow(
      "Brak dostępu",
    )
    await expect(setAdmin(headers, { userId: target.id, isAdmin: true })).rejects.toThrow(
      "Brak dostępu",
    )
  }
  expect(await row(target.id)).toEqual(before)
  expect(await db.user.count()).toBe(users + 1)
  expect(await sessionUser(target.headers)).toMatchObject({ id: target.id })
  expect(await sessionUser(await signIn(target.email))).toMatchObject({ id: target.id })
})

test("superadmin zakłada i poprawia konta; zajęty e-mail odrzucony", async () => {
  const admin = await account("admin")
  const other = await account()
  const email = `${randomUUID()}@example.com`

  expect(await addAccount(admin.headers, { email, name: "Nowy", password })).toEqual({
    ok: true,
  })
  expect(await addAccount(admin.headers, { email, name: "Drugi", password })).toEqual({
    ok: false,
    code: "EMAIL_TAKEN",
  })
  expect(await db.user.findUniqueOrThrow({ where: { email } })).toMatchObject({ role: "user" })

  expect(await editAccount(admin.headers, { userId: other.id, email, name: "Y" })).toEqual({
    ok: false,
    code: "EMAIL_TAKEN",
  })
  const renamed = `${randomUUID()}@example.com`
  expect(
    await editAccount(admin.headers, { userId: other.id, email: renamed, name: "Inna" }),
  ).toEqual({ ok: true })
  expect(await row(other.id)).toMatchObject({ email: renamed })
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

  expect(await setBanned(admin.headers, { userId: other.id, banned: true })).toEqual({ ok: true })
  expect(await row(other.id)).toMatchObject({ banned: true })
  expect(await sessionUser(other.headers)).toBeNull()
  await expect(signIn(other.email)).rejects.toThrow("You have been banned")
  expect(await setBanned(admin.headers, { userId: other.id, banned: false })).toEqual({ ok: true })
  expect(await sessionUser(await signIn(other.email))).toMatchObject({ id: other.id })
})

test("nowe hasło wylogowuje osobę i zastępuje stare", async () => {
  const admin = await account("admin")
  const other = await account()

  expect(await setPassword(admin.headers, { userId: other.id, password: "nowe-haslo-1" })).toEqual({
    ok: true,
  })
  expect(await sessionUser(other.headers)).toBeNull()
  await expect(signIn(other.email)).rejects.toThrow("Invalid email or password")
  expect(await sessionUser(await signIn(other.email, "nowe-haslo-1"))).toMatchObject({
    id: other.id,
  })
})

test("zablokowane konto z żywą sesją nie jest zalogowanym prowadzącym", async () => {
  const user = await account()
  expect(await sessionUser(user.headers)).toMatchObject({ id: user.id, isAdmin: false })
  await db.user.update({ where: { id: user.id }, data: { banned: true } })
  expect(await sessionUser(user.headers)).toBeNull()
})
