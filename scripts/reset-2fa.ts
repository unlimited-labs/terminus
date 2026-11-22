import { auth, resetTwoFactor } from "../src/server/auth.server.ts"
import { db } from "../src/server/db.server.ts"

const email = process.argv[2]
if (!email) {
  console.error("Użycie: pnpm reset-2fa <email>")
  process.exit(1)
}

const ctx = await auth.$context
const found = await ctx.internalAdapter.findUserByEmail(email)
if (!found) {
  console.error(`Nie ma konta ${email}.`)
  process.exit(1)
}

await resetTwoFactor(found.user.id)
console.log(`2FA konta ${email} zresetowane; przy logowaniu skonfiguruje je od nowa.`)
await db.$disconnect()
