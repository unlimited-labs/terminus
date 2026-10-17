import { z } from "zod"

import { OPS } from "../messages.pl.ts"

/** Puste = nieustawione (zajmuje się tym `emptyStringAsUndefined` w `env.server.ts`). */
export const smtpShape = {
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
}

type SmtpVars = { [K in keyof typeof smtpShape]?: z.infer<(typeof smtpShape)[K]> }

/** Login i hasło tylko razem: jedno bez drugiego to pomyłka w konfiguracji, aplikacja nie startuje. */
export const smtpCredentialsTogether = (v: SmtpVars) =>
  (v.SMTP_USER === undefined) === (v.SMTP_PASSWORD === undefined)

export const smtpCredentialsMessage = OPS.smtpCredentials

/** Konfiguracja transportu albo `null`: bez hosta, portu i nadawcy opcja logowania mailem jest niedostępna. */
export function smtpConfig(v: SmtpVars) {
  if (!v.SMTP_HOST || !v.SMTP_PORT || !v.SMTP_FROM) return null
  const auth = v.SMTP_USER && v.SMTP_PASSWORD ? { user: v.SMTP_USER, pass: v.SMTP_PASSWORD } : null
  return {
    host: v.SMTP_HOST,
    port: v.SMTP_PORT,
    from: v.SMTP_FROM,
    // Port 465: TLS od razu; inny: STARTTLS, jeśli serwer go oferuje.
    secure: v.SMTP_PORT === 465,
    auth,
  }
}
