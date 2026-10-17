import { z } from "zod"

import { auth } from "../src/server/auth.server.ts"
import { db } from "../src/server/db.server.ts"

if (!process.env.ADMIN_PASSWORD) {
  console.log("Brak ADMIN_PASSWORD — pomijam zakładanie superadmina.")
  process.exit(0)
}

const admin = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(8),
    ADMIN_NAME: z.string().min(1),
  })
  .parse(process.env)

const existing = await db.user.findUnique({ where: { email: admin.ADMIN_EMAIL.toLowerCase() } })
if (existing) {
  console.log(`Superadmin ${admin.ADMIN_EMAIL} już istnieje.`)
} else {
  await auth.api.createUser({
    body: {
      email: admin.ADMIN_EMAIL,
      password: admin.ADMIN_PASSWORD,
      name: admin.ADMIN_NAME,
      role: "admin",
      data: { emailVerified: true },
    },
  })
  console.log(`Utworzono superadmina ${admin.ADMIN_EMAIL}.`)
}
await db.$disconnect()
