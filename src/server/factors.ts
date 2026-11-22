import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { z } from "zod"

import { confirmPasswordSchema } from "../schemas/auth.ts"

import { disableTotp, removePasskey } from "./factor-ops.server.ts"
import { requireUser } from "./session.ts"

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ passkeyId: z.string().min(1).max(200) }))
  .handler(({ data, context }) => removePasskey(context.user.id, data.passkeyId))

export const disconnectAuthenticator = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(confirmPasswordSchema)
  .handler(({ data, context }) => disableTotp(getRequestHeaders(), context.user.id, data.password))
