import { createAccountSchema } from "../src/schemas/account.ts"
import { password } from "../src/schemas/auth.ts"

if (!process.env.ADMIN_PASSWORD) {
  console.log("Brak ADMIN_PASSWORD — pomijam zakładanie superadmina.")
  process.exit(0)
}

// Dopiero po sprawdzeniu: bez hasła skrypt nie ładuje bazy ani better-auth (start kontenera, testy).
const { auth } = await import("../src/server/auth.server.ts")
const { db } = await import("../src/server/db.server.ts")

// Te same reguły co formularz kont (adres małymi literami, długość hasła).
const admin = createAccountSchema.extend({ password }).parse({
  email: process.env.ADMIN_EMAIL,
  name: process.env.ADMIN_NAME,
  password: process.env.ADMIN_PASSWORD,
})

const existing = await db.user.findUnique({ where: { email: admin.email } })
if (existing) {
  console.log(`Superadmin ${admin.email} już istnieje.`)
} else {
  await auth.api.createUser({
    body: { ...admin, role: "admin", data: { emailVerified: true } },
  })
  console.log(`Utworzono superadmina ${admin.email}.`)
}
await db.$disconnect()
