import { createAuthClient } from "better-auth/react"
import { toast } from "sonner"

import { authErrorMessage } from "@/messages.pl"

/** Bez wtyczek 2FA: strona studenta ładuje tylko to (mniejsza paczka, szybsza hydratacja). */
export const authClient = createAuthClient()

/** Wywołanie klienta better-auth → komunikat błędu (także gdy zawiedzie sieć) albo `null` po sukcesie. */
export async function authFailure(call: Promise<{ error: object | null }>): Promise<string | null> {
  const { error } = await call.catch(() => ({ error: {} }))
  if (!error) return null
  return authErrorMessage(
    "code" in error && typeof error.code === "string" ? error.code : undefined,
  )
}

/** Wywołanie klienta better-auth; przy błędzie toast i `false`. */
export async function authWithToast(call: Promise<{ error: object | null }>) {
  const failure = await authFailure(call)
  if (failure) toast.error(failure)
  return failure === null
}

/** Wylogowanie; przy błędzie toast i `false`. */
export const signOutWithToast = () => authWithToast(authClient.signOut())
