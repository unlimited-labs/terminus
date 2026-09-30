import { inject } from "vitest"

process.env.DATABASE_URL = inject("databaseUrl")
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123"
process.env.BETTER_AUTH_URL = "http://localhost:3000"
