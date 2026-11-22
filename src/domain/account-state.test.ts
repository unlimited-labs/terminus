import { expect, test } from "vitest"

import { accountState } from "./account-state.ts"

const state = (banned: boolean, hasPassword: boolean, twoFactorReady: boolean) =>
  accountState({ banned, hasPassword, twoFactorReady })

test("blokada wygrywa, potem brak hasła, potem brak 2FA", () => {
  expect(state(true, false, false)).toBe("banned")
  expect(state(false, false, true)).toBe("invited")
  expect(state(false, true, false)).toBe("no2fa")
  expect(state(false, true, true)).toBe("active")
})
