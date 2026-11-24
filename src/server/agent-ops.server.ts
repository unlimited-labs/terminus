import { agentHost } from "../domain/agents.ts"

import { db } from "./db.server.ts"

/** Z bazy, nie `/oauth2/get-consents`: tam zgody są bez nazw klientów (zapytanie o każdego osobno). */
export async function connectedAgents(userId: string) {
  const consents = await db.oauthConsent.findMany({
    where: { userId },
    select: { clientId: true, createdAt: true, oauthclient: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return consents.map((c) => ({
    clientId: c.clientId,
    name: c.oauthclient.name || c.clientId,
    host: agentHost(c.clientId),
    connectedAt: c.createdAt,
  }))
}
