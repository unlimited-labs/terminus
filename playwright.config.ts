import { defineConfig, devices } from "@playwright/test"

import { E2E } from "./e2e/config.ts"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: E2E.baseURL, locale: "pl-PL", timezoneId: "Europe/Warsaw" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && node e2e/serve.ts",
    url: `${E2E.baseURL}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
})
