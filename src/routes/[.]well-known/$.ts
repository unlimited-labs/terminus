import { createFileRoute } from "@tanstack/react-router"

import { auth } from "@/server/auth.server"

/** Metadane OAuth dla klientów MCP (RFC 8414, RFC 9728) muszą być w korzeniu domeny, nie pod `/api/auth`. */
export const Route = createFileRoute("/.well-known/$")({
  server: { handlers: { GET: ({ request }) => auth.handler(request) } },
})
