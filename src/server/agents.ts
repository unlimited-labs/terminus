import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { z } from "zod"

import { agentHost } from "../domain/agents.ts"

import { auth } from "./auth.server.ts"

/** Agent AI na ekranie zgody: nazwa podana przez klienta i host jego `client_id`; `null` bez sesji albo klienta. */
export const agentToConnect = createServerFn()
  .validator(z.object({ clientId: z.string().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const client = await auth.api
      .getOAuthClientPublic({ query: { client_id: data.clientId }, headers: getRequestHeaders() })
      .catch(() => null)
    if (!client) return null
    return { name: client.client_name || data.clientId, host: agentHost(data.clientId) }
  })
