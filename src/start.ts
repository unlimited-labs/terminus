import { createMiddleware, createStart } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { logCall } from "./server/call-log.server.ts"

const logServerFn = createMiddleware({ type: "function" }).server(({ next, data, serverFnMeta }) =>
  logCall({ name: serverFnMeta.name, write: getRequest().method !== "GET", data }, () => next()),
)

export const startInstance = createStart(() => ({ functionMiddleware: [logServerFn] }))
