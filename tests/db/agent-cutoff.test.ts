import { randomUUID } from "node:crypto"

import { expect, test, vi } from "vitest"

import { resetAccountTwoFactor, setBanned } from "@/server/account-ops.server"
import { auth, deleteAgentGrants, replacePassword } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { sendMail } from "@/server/mail.server"
import { sendPasswordLink } from "@/server/password-link.server"

import { account, TEST_PASSWORD } from "./sessions"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

/** Podłączony agent: klient, zgoda, refresh token i access token (jak po przejściu przez `/zgoda`). */
async function connectAgent(userId: string, clientId = `https://${randomUUID()}.example.com/cimd`) {
  const now = new Date()
  const expiresAt = new Date(Date.now() + 60_000)
  await db.oauthClient.upsert({
    where: { clientId },
    create: { id: randomUUID(), clientId, scopes: [], contacts: [], redirectUris: [] },
    update: {},
  })
  await db.oauthConsent.create({
    data: {
      id: randomUUID(),
      clientId,
      userId,
      scopes: ["offline_access"],
      createdAt: now,
      updatedAt: now,
    },
  })
  const refresh = await db.oauthRefreshToken.create({
    data: {
      id: randomUUID(),
      token: randomUUID(),
      clientId,
      userId,
      scopes: ["offline_access"],
      expiresAt,
      createdAt: now,
    },
  })
  await db.oauthAccessToken.create({
    data: {
      id: randomUUID(),
      token: randomUUID(),
      clientId,
      userId,
      refreshId: refresh.id,
      expiresAt,
      createdAt: now,
    },
  })
  // Access token bez refresh tokenu (np. bez `offline_access`) nie znika kaskadą.
  await db.oauthAccessToken.create({
    data: { id: randomUUID(), token: randomUUID(), clientId, userId, expiresAt, createdAt: now },
  })
  return clientId
}

/** Wiersze zgody i tokenów agentów konta. */
const agentRows = async (userId: string) => ({
  consents: await db.oauthConsent.count({ where: { userId } }),
  refreshTokens: await db.oauthRefreshToken.count({ where: { userId } }),
  accessTokens: await db.oauthAccessToken.count({ where: { userId } }),
})

const none = { consents: 0, refreshTokens: 0, accessTokens: 0 }

test("blokada odcina agentów; odblokowanie nie przywraca zgody", async () => {
  const admin = await account("admin")
  const teacher = await account()
  const bystander = await account()
  await connectAgent(teacher.id)
  await connectAgent(bystander.id)
  expect(await agentRows(teacher.id)).toEqual({ consents: 1, refreshTokens: 1, accessTokens: 2 })

  await setBanned(admin.headers, { userId: teacher.id, banned: true })
  expect(await agentRows(teacher.id)).toEqual(none)
  await setBanned(admin.headers, { userId: teacher.id, banned: false })
  expect(await agentRows(teacher.id)).toEqual(none)
  expect(await agentRows(bystander.id)).not.toEqual(none)
})

test("reset 2FA odcina agentów", async () => {
  const admin = await account("admin")
  const teacher = await account()
  await connectAgent(teacher.id)
  await resetAccountTwoFactor(admin.headers, { userId: teacher.id })
  expect(await agentRows(teacher.id)).toEqual(none)
})

test("nowe hasło skryptem odcina agentów", async () => {
  const teacher = await account()
  await connectAgent(teacher.id)
  await replacePassword(teacher.id, "nowe-haslo-123")
  expect(await agentRows(teacher.id)).toEqual(none)
})

test("hasło z linku odcina agentów", async () => {
  const teacher = await account()
  await connectAgent(teacher.id)
  await sendPasswordLink(teacher.id)
  const link = new URL(/https?:\/\/\S+/.exec(vi.mocked(sendMail).mock.calls.at(-1)![0].text)![0])
  await auth.api.resetPassword({
    body: { token: link.searchParams.get("token")!, newPassword: "nowe-haslo-123" },
  })
  expect(await agentRows(teacher.id)).toEqual(none)
})

test("zmiana hasła z wylogowaniem innych sesji odcina agentów; złe hasło niczego nie rusza", async () => {
  const teacher = await account()
  await connectAgent(teacher.id)
  const change = (currentPassword: string) =>
    auth.api.changePassword({
      body: { currentPassword, newPassword: "nowe-haslo-123", revokeOtherSessions: true },
      headers: teacher.headers,
    })
  await expect(change("zle-haslo-123")).rejects.toMatchObject({
    body: { code: "INVALID_PASSWORD" },
  })
  expect(await agentRows(teacher.id)).not.toEqual(none)
  await change(TEST_PASSWORD)
  expect(await agentRows(teacher.id)).toEqual(none)
})

test("odłączenie jednego klienta zostawia pozostałych", async () => {
  const teacher = await account()
  const claude = await connectAgent(teacher.id)
  const chatgpt = await connectAgent(teacher.id)
  await deleteAgentGrants(teacher.id, claude)
  expect(await db.oauthConsent.findMany({ where: { userId: teacher.id } })).toMatchObject([
    { clientId: chatgpt },
  ])
  expect(await agentRows(teacher.id)).toEqual({ consents: 1, refreshTokens: 1, accessTokens: 2 })
})
