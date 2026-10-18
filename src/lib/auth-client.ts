import { createAuthClient } from "better-auth/react"
import { toast } from "sonner"

import { authErrorMessage } from "@/messages.pl"

export const authClient = createAuthClient()

/** Wywołanie klienta better-auth → komunikat błędu albo `null` po sukcesie (także gdy zawiedzie sieć). */
export async function authFailure(
  call: Promise<{ error: { code?: string } | null }>,
): Promise<string | null> {
  const { error } = await call.catch(() => ({ error: { code: undefined } }))
  return error ? authErrorMessage(error.code) : null
}

/** Wylogowanie; przy błędzie toast i `false`. */
export async function signOutWithToast() {
  const failure = await authFailure(authClient.signOut())
  if (failure) toast.error(failure)
  return failure === null
}
