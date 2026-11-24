import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { z } from "zod"

import { agentHost } from "../domain/agents.ts"

import { connectedAgents } from "./agent-ops.server.ts"
import { auth, disconnectAgents, MCP_RESOURCE } from "./auth.server.ts"
import { requireUser } from "./session.ts"

const clientIdSchema = z.object({ clientId: z.string().min(1).max(2000) })

/** Agent AI na ekranie zgody: nazwa podana przez klienta i host jego `client_id`; `null` bez sesji albo klienta. */
export const agentToConnect = createServerFn()
  .validator(clientIdSchema)
  .handler(async ({ data }) => {
    const client = await auth.api
      .getOAuthClientPublic({ query: { client_id: data.clientId }, headers: getRequestHeaders() })
      .catch(() => null)
    if (!client) return null
    return { name: client.client_name || data.clientId, host: agentHost(data.clientId) }
  })

const listAgents = createServerFn()
  .middleware([requireUser])
  .handler(async ({ context }) => ({
    mcpUrl: MCP_RESOURCE,
    agents: await connectedAgents(context.user.id),
  }))

export const agentsQuery = () => queryOptions({ queryKey: ["agents"], queryFn: () => listAgents() })

export const disconnectAgent = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(clientIdSchema)
  .handler(async ({ data, context }) => {
    await disconnectAgents(context.user.id, data.clientId)
  })
