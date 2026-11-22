/** Stan konta prowadzącego (CONTEXT.md „Stan konta”): wyliczany z danych, blokada ma pierwszeństwo. */
export type AccountState = "invited" | "no2fa" | "active" | "banned"

export function accountState(a: {
  banned: boolean | null
  hasPassword: boolean
  twoFactorReady: boolean
}): AccountState {
  if (a.banned) return "banned"
  if (!a.hasPassword) return "invited"
  return a.twoFactorReady ? "active" : "no2fa"
}
