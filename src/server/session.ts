import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { auth } from "./auth.server.ts"

async function currentUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session || session.user.banned) return null
  const { id, name, email, role } = session.user
  return { id, name, email, isAdmin: role === "admin" }
}

export const getSessionUser = createServerFn().handler(currentUser)

/** Sesja prowadzącego; zablokowane konto = odmowa. */
export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await currentUser()
  if (!user) throw new Error("Brak dostępu")
  return next({ context: { user } })
})

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireUser])
  .server(({ next, context }) => {
    if (!context.user.isAdmin) throw new Error("Brak dostępu")
    return next()
  })
