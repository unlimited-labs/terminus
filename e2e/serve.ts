// Serwer do testów e2e: PostgreSQL w kontenerze, migracje, superadmin, dane testowe, aplikacja.
import { execSync, spawn } from "node:child_process"
import { writeFileSync } from "node:fs"

import { PostgreSqlContainer } from "@testcontainers/postgresql"

import { E2E, STATE_FILE } from "./config.ts"

const container = await new PostgreSqlContainer("postgres:18-alpine").start()
const env = {
  ...process.env,
  DATABASE_URL: container.getConnectionUri(),
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
  BETTER_AUTH_URL: E2E.baseURL,
  ADMIN_EMAIL: E2E.admin.email,
  ADMIN_PASSWORD: E2E.admin.password,
  ADMIN_NAME: E2E.admin.name,
  PORT: String(E2E.port),
}
Object.assign(process.env, env)
execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" })
execSync("node scripts/seed-admin.ts", { env, stdio: "inherit" })

const { seed } = await import("./seed.ts")
writeFileSync(STATE_FILE, JSON.stringify(await seed()))

const app = spawn("node", [".output/server/index.mjs"], { env, stdio: "inherit" })
const stop = async () => {
  app.kill()
  await container.stop()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
