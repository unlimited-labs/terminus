import { createFileRoute } from "@tanstack/react-router"

import { mcpHandler, serveMcp } from "@/server/mcp.server"

/** Serwer MCP prowadzącego; GET i DELETE (sesje 2025) SDK odrzuca 405, bez tokenu. */
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => serveMcp(request),
      GET: ({ request }) => mcpHandler.fetch(request),
      DELETE: ({ request }) => mcpHandler.fetch(request),
    },
  },
})
