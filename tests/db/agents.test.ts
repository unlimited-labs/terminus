import { randomUUID } from "node:crypto"

import { expect, test } from "vitest"

import { connectedAgents } from "@/server/agent-ops.server"
import { db } from "@/server/db.server"

import { account } from "./sessions"

/** Zgoda prowadzącego na klienta (jak po `/zgoda`). */
async function consent(userId: string, clientId: string, name: string | null, createdAt: Date) {
  await db.oauthClient.upsert({
    where: { clientId },
    create: { id: randomUUID(), clientId, name, redirectUris: [] },
    update: {},
  })
  await db.oauthConsent.create({
    data: {
      id: randomUUID(),
      clientId,
      userId,
      scopes: ["offline_access"],
      createdAt,
      updatedAt: createdAt,
    },
  })
}

test("lista agentów pokazuje tylko zgody zalogowanego prowadzącego: nazwa, host, data", async () => {
  const teacher = await account()
  const other = await account()
  const claude = `https://${randomUUID()}.claude.example/cimd.json`
  const plain = `klient-${randomUUID()}`
  await consent(teacher.id, claude, "Claude", new Date("2026-11-20T10:00:00Z"))
  await consent(teacher.id, plain, null, new Date("2026-11-21T10:00:00Z"))
  await consent(other.id, `https://${randomUUID()}.inny.example/cimd`, "Cudzy", new Date())

  expect(await connectedAgents(teacher.id)).toEqual([
    {
      clientId: plain,
      name: plain,
      host: null,
      connectedAt: new Date("2026-11-21T10:00:00Z"),
    },
    {
      clientId: claude,
      name: "Claude",
      host: new URL(claude).host,
      connectedAt: new Date("2026-11-20T10:00:00Z"),
    },
  ])
})
