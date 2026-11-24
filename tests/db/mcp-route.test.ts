import { randomUUID } from "node:crypto"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { auth, disconnectAgents, MCP_RESOURCE } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { mcpHandler, serveMcp } from "@/server/mcp.server"

import { account } from "./sessions"

const CLIENT_ID = "https://klient.example.com/cimd.json"

// `requireMcpAuth` pobiera klucze z `<APP_PUBLIC_URL>/api/auth/jwks`; serwera HTTP w testach nie ma.
beforeEach(() => {
  const realFetch = globalThis.fetch
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    return url.startsWith("http://localhost:3000/api/auth/")
      ? auth.handler(new Request(url, init))
      : realFetch(input, init)
  })
})
afterEach(() => vi.unstubAllGlobals())

/** Prowadzący, który podłączył klienta (wiersz zgody), i access token jak z `/oauth2/token`. */
async function connected() {
  const teacher = await account()
  await db.oauthClient.upsert({
    where: { clientId: CLIENT_ID },
    update: {},
    create: {
      id: randomUUID(),
      clientId: CLIENT_ID,
      redirectUris: ["https://klient.example.com/cb"],
    },
  })
  await db.oauthConsent.create({
    data: {
      id: randomUUID(),
      clientId: CLIENT_ID,
      userId: teacher.id,
      scopes: ["offline_access"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  const { token } = await auth.api.signJWT({
    body: {
      payload: {
        sub: teacher.id,
        azp: CLIENT_ID,
        aud: MCP_RESOURCE,
        scope: "offline_access",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    },
  })
  return { ...teacher, token }
}

const listTools = (token?: string) =>
  serveMcp(
    new Request(MCP_RESOURCE, {
      method: "POST",
      headers: {
        ...(token && { authorization: `Bearer ${token}` }),
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
  )

/** Status i wezwanie do logowania (RFC 9728), po którym klient wraca do `/login` i zgody. */
const challenge = (res: Response) => [res.status, res.headers.get("www-authenticate")]

const UNAUTHORIZED = [
  401,
  expect.stringContaining(
    'resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"',
  ),
]

test("token prowadzącego ze zgodą wpuszcza; bez tokenu 401 z WWW-Authenticate", async () => {
  const { token } = await connected()
  expect((await listTools(token)).status).toBe(200)
  expect(challenge(await listTools())).toEqual(UNAUTHORIZED)
})

test("GET i DELETE (sesje klientów 2025) → 405", async () => {
  for (const method of ["GET", "DELETE"]) {
    const res = await mcpHandler.fetch(
      new Request(MCP_RESOURCE, { method, headers: { accept: "text/event-stream" } }),
    )
    expect(res.status).toBe(405)
  }
})

test("„Odłącz” w sekcji Agenci AI i zablokowane konto: kolejne żądanie 401", async () => {
  const unplugged = await connected()
  const colleague = await connected()
  await disconnectAgents(unplugged.id, CLIENT_ID)
  expect(challenge(await listTools(unplugged.token))).toEqual(UNAUTHORIZED)
  expect((await listTools(colleague.token)).status).toBe(200)

  const banned = await connected()
  await db.user.update({ where: { id: banned.id }, data: { banned: true } })
  expect(challenge(await listTools(banned.token))).toEqual(UNAUTHORIZED)
})
