import { passkeyClient } from "@better-auth/passkey/client"
import { twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** Klient z kluczami dostępu i TOTP — tylko ekrany prowadzącego. */
export const teacherAuthClient = createAuthClient({ plugins: [twoFactorClient(), passkeyClient()] })
