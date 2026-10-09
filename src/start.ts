import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { logCall } from "./server/call-log.server.ts"

// Własny start.ts wyłącza domyślną ochronę CSRF Starta; tylko funkcje serwerowe, bo wejście z paska adresu nie ma Origin.
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })

const logServerFn = createMiddleware({ type: "function" }).server(({ next, data, serverFnMeta }) =>
  logCall({ name: serverFnMeta.name, write: getRequest().method !== "GET", data }, () => next()),
)

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf],
  functionMiddleware: [logServerFn],
}))
