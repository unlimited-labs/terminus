import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { db } from "./db.server.ts"
import { env } from "./env.server.ts"

const adminPlugin = admin()

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
  // Panel kont woła auth.api po stronie serwera; przez HTTP nikt nie podszyje się ani nie usunie konta.
  disabledPaths: Object.values(adminPlugin.endpoints).map((e) => e.path),
  plugins: [adminPlugin, tanstackStartCookies()],
})
