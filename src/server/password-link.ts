import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { forgotPasswordSchema } from "../schemas/auth.ts"

import { limitKey } from "./attempt-limit.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import { passwordLinkInfo, requestPasswordLink } from "./password-link.server.ts"

/** Zawsze `ok`: odpowiedź nie zdradza, czy adres ma konto. */
export const forgotPassword = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    await requestPasswordLink(data.email, limitKey(getRequestHeader("x-real-ip")))
    return { ok: true as const }
  })

export const mailAvailable = createServerFn().handler(() => emailLoginAvailable)

export const passwordLink = createServerFn()
  .validator(z.object({ token: z.string().min(1).max(200) }))
  .handler(({ data }) => passwordLinkInfo(data.token))
