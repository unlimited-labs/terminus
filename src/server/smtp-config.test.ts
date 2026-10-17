import { expect, test } from "vitest"
import { z } from "zod"

import { smtpConfig, smtpCredentialsTogether, smtpShape } from "./smtp-config"

const full = { SMTP_HOST: "smtp.agh.edu.pl", SMTP_PORT: 587, SMTP_FROM: "Terminus <t@agh.edu.pl>" }

test("komplet host + port + nadawca = dostępne, bez logowania", () => {
  expect(smtpConfig(full)).toEqual({
    host: "smtp.agh.edu.pl",
    port: 587,
    from: "Terminus <t@agh.edu.pl>",
    secure: false,
    auth: null,
  })
})

test("brak któregokolwiek z trzech wymaganych = niedostępne", () => {
  expect(smtpConfig({ ...full, SMTP_HOST: undefined })).toBeNull()
  expect(smtpConfig({ ...full, SMTP_PORT: undefined })).toBeNull()
  expect(smtpConfig({ ...full, SMTP_FROM: undefined })).toBeNull()
  expect(smtpConfig({})).toBeNull()
})

test("port 465 = TLS od razu; login i hasło trafiają do transportu", () => {
  expect(smtpConfig({ ...full, SMTP_PORT: 465, SMTP_USER: "u", SMTP_PASSWORD: "p" })).toMatchObject(
    {
      secure: true,
      auth: { user: "u", pass: "p" },
    },
  )
})

test("sam login albo samo hasło to błąd konfiguracji", () => {
  const schema = z.object(smtpShape).refine(smtpCredentialsTogether)
  expect(schema.safeParse({ ...full, SMTP_USER: "u" }).success).toBe(false)
  expect(schema.safeParse({ ...full, SMTP_PASSWORD: "p" }).success).toBe(false)
  expect(schema.safeParse({ ...full, SMTP_USER: "u", SMTP_PASSWORD: "p" }).success).toBe(true)
  expect(schema.safeParse({ SMTP_PORT: "587" }).data?.SMTP_PORT).toBe(587)
})
