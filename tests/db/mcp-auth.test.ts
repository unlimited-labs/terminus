import { randomUUID } from "node:crypto"

import type { mcp } from "@better-auth/mcp"
import { expect, test } from "vitest"

import { auth, teacherById } from "@/server/auth.server"
import { db } from "@/server/db.server"

import { account } from "./sessions"

const student = async () => {
  const { id } = await db.user.create({
    data: { id: randomUUID(), name: "", email: `${randomUUID()}@s.example.com`, role: "student" },
  })
  return id
}

const banned = async () => {
  const { id } = await account()
  await db.user.update({ where: { id }, data: { banned: true } })
  return id
}

const without2fa = async () => (await account("user", { twoFactor: false })).id

test("teacherById: aktywny prowadzący z 2FA tak; student, zablokowany i konto bez 2FA nie", async () => {
  const teacher = await account("admin")
  expect(await teacherById(teacher.id)).toMatchObject({ id: teacher.id, isAdmin: true })
  expect(await teacherById(await student())).toBeNull()
  expect(await teacherById(await banned())).toBeNull()
  expect(await teacherById(await without2fa())).toBeNull()
  expect(await teacherById("nie-ma")).toBeNull()
})

const tokenClaims = async (userId: string) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const provider = auth.options.plugins.find(
    (p): p is ReturnType<typeof mcp> => p.id === "oauth-provider",
  )
  return provider!.options.customAccessTokenClaims!({ user, scopes: [] })
}

test("access token MCP: wydany prowadzącemu z 2FA, odmowa dla studenta, zablokowanego i konta bez 2FA", async () => {
  expect(await tokenClaims((await account()).id)).toEqual({})
  await expect(tokenClaims(await student())).rejects.toThrow("MCP jest tylko dla prowadzących.")
  await expect(tokenClaims(await banned())).rejects.toThrow("MCP jest tylko dla prowadzących.")
  await expect(tokenClaims(await without2fa())).rejects.toThrow("MCP jest tylko dla prowadzących.")
})
