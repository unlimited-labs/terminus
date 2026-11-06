import { createAuthClient } from "better-auth/react"
import { toast } from "sonner"

import { authErrorMessage } from "@/messages.pl"

export const authClient = createAuthClient()

/** Wywołanie klienta better-auth → komunikat błędu (także gdy zawiedzie sieć) albo `null` po sukcesie. */
export async function authFailure(
  call: Promise<{ error: { code?: string } | null }>,
): Promise<string | null> {
  const { error } = await call.catch(() => ({ error: { code: undefined } }))
  return error ? authErrorMessage(error.code) : null
}

/** Wywołanie klienta better-auth; przy błędzie toast i `false`. */
export async function authWithToast(call: Promise<{ error: { code?: string } | null }>) {
  const failure = await authFailure(call)
  if (failure) toast.error(failure)
  return failure === null
}

/** Wylogowanie; przy błędzie toast i `false`. */
export const signOutWithToast = () => authWithToast(authClient.signOut())
