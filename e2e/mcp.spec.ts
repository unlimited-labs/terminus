import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"

import { expect, request, test } from "@playwright/test"
import { z } from "zod"

import { E2E } from "./config.ts"
import { adminTotp, exams, fillLogin, hydrated } from "./helpers.ts"
import { totpCode } from "./totp.ts"

const { clientId, name, redirectUri } = E2E.agent
const resource = `${E2E.baseURL}/mcp`
const toolResult = z.object({
  result: z.object({ isError: z.boolean().optional(), structuredContent: z.unknown() }),
})

// Przeglądarka po zgodzie wraca na `redirect_uri`; `page.route` tego przekierowania nie łapie.
const callback = createServer((_req, res) => res.end("agent"))
test.beforeAll(() => void callback.listen(Number(new URL(redirectUri).port), "127.0.0.1"))
test.afterAll(() => void callback.close())

test("agent AI: logowanie z TOTP, zgoda, token, narzędzia MCP, odłączenie odcina dostęp", async ({
  page,
}) => {
  const verifier = randomBytes(32).toString("base64url")
  await page.goto(
    `/api/auth/oauth2/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      state: "stan-1",
      scope: "openid offline_access",
      resource,
    })}`,
  )
  await page.waitForURL(/\/login\?.*sig=/)
  await fillLogin(page, E2E.admin.email, E2E.admin.password)
  await page.getByLabel("Kod z aplikacji").fill(await totpCode(adminTotp()))

  await page.waitForURL(/\/zgoda\?/)
  await expect(page.getByText(`${name} będzie działać w Twoim imieniu`)).toBeVisible()
  await (await hydrated(page.getByRole("button", { name: "Podłącz" }))).click()
  await page.waitForURL((url) => url.href.startsWith(redirectUri))
  const back = new URL(page.url()).searchParams
  expect(back.get("state")).toBe("stan-1")

  // Agent to osobny klient HTTP: bez ciasteczek przeglądarki (z nimi token odpowiada 403).
  const agent = await request.newContext({ baseURL: E2E.baseURL })
  const token = await agent.post("/api/auth/oauth2/token", {
    form: {
      grant_type: "authorization_code",
      code: back.get("code")!,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
      resource,
    },
  })
  expect(token.status()).toBe(200)
  const { access_token } = z.object({ access_token: z.string() }).parse(await token.json())

  let id = 0
  const callTool = (tool: string, args: object) =>
    agent.post("/mcp", {
      headers: {
        authorization: `Bearer ${access_token}`,
        accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: ++id,
        method: "tools/call",
        params: { name: tool, arguments: args },
      },
    })
  const result = async (tool: string, args: object) => {
    const res = await callTool(tool, args)
    expect(res.status()).toBe(200)
    // Żądanie bez wersji protokołu idzie ścieżką z 2025 r., która odpowiada strumieniem SSE.
    const text = await res.text()
    const body = toolResult.parse(JSON.parse(/^data: (.*)$/m.exec(text)?.[1] ?? text))
    expect(body.result.isError).toBeFalsy()
    return body.result.structuredContent
  }

  const examId = exams().agent
  expect(await result("list_exams", {})).toMatchObject({
    exams: expect.arrayContaining([expect.objectContaining({ id: examId, name: "Agent E2E" })]),
  })
  expect(
    await result("board_command", {
      examId,
      command: { kind: "rename", studentNumber: "730001", firstName: "Alicja", lastName: "Agent" },
    }),
  ).toEqual({
    inverse: { kind: "rename", studentNumber: "730001", firstName: "Ala", lastName: "Agent" },
  })

  await page.goto("/weryfikacja-dwuetapowa")
  const agents = page.getByRole("list", { name: "Podłączeni agenci" })
  const row = agents.getByRole("listitem").filter({ hasText: name })
  await (await hydrated(row.getByRole("button", { name: "Odłącz" }))).click()
  await page
    .getByRole("dialog", { name: "Odłączyć agenta?" })
    .getByRole("button", { name: "Odłącz agenta" })
    .click()
  await expect(agents).toHaveText("Brak podłączonych agentów.")

  const cut = await callTool("list_exams", {})
  expect(cut.status()).toBe(401)
  expect(cut.headers()["www-authenticate"]).toContain("Bearer")
})
