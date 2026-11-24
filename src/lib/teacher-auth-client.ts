import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { passkeyClient } from "@better-auth/passkey/client"
import { twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** Klient z kluczami dostępu i TOTP — tylko ekrany prowadzącego. */
export const teacherAuthClient = createAuthClient({ plugins: [twoFactorClient(), passkeyClient()] })

/**
 * Jak `teacherAuthClient`, ale dokleja podpisane parametry OAuth z adresu strony (`sig`) do każdego POST-a:
 * logowanie i zgoda w podłączaniu agenta AI. Nie na `/konfiguracja-2fa`: tam pierwszy `verify-totp`
 * odnawia sesję i serwer przeniósłby na `/zgoda` przed kodami zapasowymi.
 */
export const oauthAuthClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient(), oauthProviderClient()],
})
