import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { sessionUser } from "./auth.server.ts"

export const getSessionUser = createServerFn().handler(() => sessionUser(getRequestHeaders()))

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await sessionUser(getRequestHeaders())
  if (!user) throw new Error("Brak dostępu")
  return next({ context: { user } })
})

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireUser])
  .server(({ next, context }) => {
    if (!context.user.isAdmin) throw new Error("Brak dostępu")
    return next()
  })
