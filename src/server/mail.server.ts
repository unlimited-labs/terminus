import { createTransport } from "nodemailer"

import { smtp } from "./env.server.ts"

const transport = smtp
  ? createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth ?? undefined,
    })
  : null

/** Wysyła mail przez SMTP z `.env`; bez konfiguracji zawodzi, więc nic nie wychodzi po cichu. */
export async function sendMail(message: {
  to: string
  subject: string
  text: string
  html: string
}) {
  if (!smtp || !transport) throw new Error("SMTP nie jest skonfigurowany.")
  await transport.sendMail({ from: smtp.from, ...message })
}
