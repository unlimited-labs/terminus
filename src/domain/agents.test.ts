import { expect, test } from "vitest"

import { agentHost } from "./agents.ts"

test("host agenta z client_id: adres dokumentu CIMD tak, zwykły identyfikator nie", () => {
  expect(agentHost("https://claude.ai/oauth/mcp-oauth-client-metadata")).toBe("claude.ai")
  expect(agentHost("http://localhost:3333/client.json")).toBe("localhost:3333")
  expect(agentHost("e2e-agent")).toBeNull()
})
