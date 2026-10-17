// Serwer do testów e2e: PostgreSQL w kontenerze, migracje, superadmin, dane testowe, aplikacja.
import { execSync, spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import type { AddressInfo } from "node:net"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { simpleParser } from "mailparser"
import { SMTPServer } from "smtp-server"

import { E2E, MAIL_FILE, STATE_FILE } from "./config.ts"

// Fałszywy SMTP: zbiera maile aplikacji do pliku, z którego czytają je testy.
const mails: { to: string; subject: string; text: string }[] = []
writeFileSync(MAIL_FILE, "[]")
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  onData(stream, session, done) {
    simpleParser(stream).then((mail) => {
      const to = session.envelope.rcptTo.map((r) => r.address).join(",")
      mails.push({ to, subject: mail.subject ?? "", text: mail.text ?? "" })
      writeFileSync(MAIL_FILE, JSON.stringify(mails))
      done()
    }, done)
  },
})
await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve))
const smtpPort = (smtp.server.address() as AddressInfo).port

const container = await new PostgreSqlContainer("postgres:18-alpine").start()
const env = {
  ...process.env,
  DATABASE_URL: container.getConnectionUri(),
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
  APP_PUBLIC_URL: E2E.baseURL,
  ADMIN_EMAIL: E2E.admin.email,
  ADMIN_PASSWORD: E2E.admin.password,
  ADMIN_NAME: E2E.admin.name,
  PORT: String(E2E.port),
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(smtpPort),
  SMTP_FROM: "Terminus E2E <terminus@e2e.test>",
}
Object.assign(process.env, env)
execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" })
execSync("node scripts/seed-admin.ts", { env, stdio: "inherit" })

const { seed } = await import("./seed.ts")
writeFileSync(STATE_FILE, JSON.stringify(await seed()))

const app = spawn("node", [".output/server/index.mjs"], { env, stdio: "inherit" })
const stop = async () => {
  app.kill()
  smtp.close()
  await container.stop()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
