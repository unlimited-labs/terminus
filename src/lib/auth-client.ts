import { createAuthClient } from "better-auth/react"
import { toast } from "sonner"

import { authErrorMessage } from "@/messages.pl"

/** Bez wtyczek 2FA: strona studenta ładuje tylko to (mniejsza paczka, szybsza hydratacja). */
export const authClient = createAuthClient()

type AuthCall<T> = Promise<{ data: T; error: null } | { data: null; error: object }>

/** Wywołanie klienta better-auth → dane albo komunikat błędu (także gdy zawiedzie sieć). */
export async function authResult<T>(
  call: AuthCall<T>,
): Promise<{ data: T; failure: null } | { data: null; failure: string }> {
  const res = await call.catch(() => ({ data: null, error: {} }))
  if (res.error === null) return { data: res.data, failure: null }
  const { error } = res
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined
  return { data: null, failure: authErrorMessage(code) }
}

/** Wywołanie klienta better-auth → komunikat błędu albo `null` po sukcesie. */
export const authFailure = async (call: AuthCall<unknown>) => (await authResult(call)).failure

/** Wywołanie klienta better-auth; przy błędzie toast i `false`. */
export async function authWithToast(call: AuthCall<unknown>) {
  const failure = await authFailure(call)
  if (failure) toast.error(failure)
  return failure === null
}

/** Wylogowanie; przy błędzie toast i `false`. */
export const signOutWithToast = () => authWithToast(authClient.signOut())
