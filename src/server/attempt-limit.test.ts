import { expect, test } from "vitest"

import { isBlocked, recordFailure } from "./attempt-limit"

test("po 10 nieudanych próbach z jednego IP blokada; inne IP bez blokady", async () => {
  for (let i = 0; i < 9; i++) await recordFailure("1.1.1.1")
  expect(await isBlocked("1.1.1.1")).toBe(false)
  await recordFailure("1.1.1.1")
  expect(await isBlocked("1.1.1.1")).toBe(true)
  expect(await isBlocked("2.2.2.2")).toBe(false)
})
