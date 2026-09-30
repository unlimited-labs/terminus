import { execFileSync } from "node:child_process"

import { expect, test } from "vitest"

import { auth } from "@/server/auth"
import { db } from "@/server/db"

test("createUser działa przy wyłączonej rejestracji, a publiczny sign-up jest zablokowany", async () => {
  const { user } = await auth.api.createUser({
    body: { email: "prowadzacy@example.com", password: "haslo-123456", name: "Jan Kowalski" },
  })
  expect(user.email).toBe("prowadzacy@example.com")

  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "obcy@example.com", password: "haslo-123456", name: "Obcy" }),
    }),
  )
  expect(response.ok).toBe(false)
  expect(await db.user.count({ where: { email: "obcy@example.com" } })).toBe(0)
})

test("skrypt pierwszego superadmina jest idempotentny", () => {
  const env = {
    ...process.env,
    ADMIN_EMAIL: "Szef@Example.com",
    ADMIN_PASSWORD: "haslo-admina-1",
    ADMIN_NAME: "Szef",
  }
  const run = () => execFileSync("node", ["scripts/seed-admin.ts"], { env, encoding: "utf8" })
  expect(run()).toContain("Utworzono")
  expect(run()).toContain("już istnieje")
  return expect(db.user.findMany({ where: { email: "szef@example.com" } })).resolves.toMatchObject([
    { role: "admin" },
  ])
})
