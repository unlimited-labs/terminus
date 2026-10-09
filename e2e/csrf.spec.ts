import { expect, test } from "@playwright/test"

import { E2E } from "./config.ts"
import { login } from "./helpers.ts"

test("funkcja serwerowa odrzuca wywołanie z obcej domeny", async ({ page }) => {
  const call = page.waitForRequest(/_serverFn/)
  await login(page)
  const url = (await call).url()

  const foreign = await page.request.get(url, { headers: { origin: "https://evil.example" } })
  expect(foreign.status()).toBe(403)
  const own = await page.request.get(url, { headers: { origin: new URL(E2E.baseURL).origin } })
  expect(own.status()).toBe(200)
})
