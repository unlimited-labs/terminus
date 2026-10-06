import { randomBytes } from "node:crypto"

import { auth, replacePassword } from "../src/server/auth.server.ts"
import { db } from "../src/server/db.server.ts"

const email = process.argv[2]
if (!email) {
  console.error("Użycie: pnpm reset-password <email>")
  process.exit(1)
}

const ctx = await auth.$context
const found = await ctx.internalAdapter.findUserByEmail(email)
if (!found) {
  console.error(`Nie ma konta ${email}.`)
  process.exit(1)
}

const password = randomBytes(12).toString("base64url")
await replacePassword(found.user.id, password)
console.log(`Nowe hasło dla ${email}: ${password}`)
await db.$disconnect()
