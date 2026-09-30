import { randomBytes } from "node:crypto"

import { auth } from "../src/server/auth.ts"
import { db } from "../src/server/db.ts"

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
await ctx.internalAdapter.updatePassword(found.user.id, await ctx.password.hash(password))
await ctx.internalAdapter.deleteUserSessions(found.user.id)
console.log(`Nowe hasło dla ${email}: ${password}`)
await db.$disconnect()
