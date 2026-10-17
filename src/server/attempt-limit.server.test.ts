import { expect, test } from "vitest"

import { isBlocked, recordOutcome } from "./attempt-limit.server"

const notOnRoster = { ok: false, code: "NOT_ON_ROSTER" } as const

test("po 10 nieudanych próbach z jednego IP blokada; inne IP bez blokady", async () => {
  for (let i = 0; i < 9; i++) await recordOutcome("1.1.1.1", ["1"], notOnRoster)
  expect(await isBlocked("1.1.1.1")).toBe(false)
  await recordOutcome("1.1.1.1", ["1"], notOnRoster)
  expect(await isBlocked("1.1.1.1")).toBe(true)
  expect(await isBlocked("2.2.2.2")).toBe(false)
})

test("każdy sprawdzony numer kosztuje punkt: 3 zespoły po 4 z brakiem na liście blokują", async () => {
  const team = ["1", "2", "3", "999"]
  await recordOutcome("3.3.3.3", team, notOnRoster)
  await recordOutcome("3.3.3.3", team, notOnRoster)
  expect(await isBlocked("3.3.3.3")).toBe(false)
  await recordOutcome("3.3.3.3", team, notOnRoster)
  expect(await isBlocked("3.3.3.3")).toBe(true)
})

test("inne wyniki niż „nie ma na liście” nie zużywają limitu", async () => {
  for (let i = 0; i < 20; i++) {
    await recordOutcome("4.4.4.4", ["1", "2"], { ok: false, code: "ALREADY_ENROLLED" })
    await recordOutcome("4.4.4.4", ["1", "2"], { ok: true })
  }
  expect(await isBlocked("4.4.4.4")).toBe(false)
})

test("slot niedostępny kosztuje tyle co „nie ma na liście”; zmiana sposobu i slot innej listy nic", async () => {
  await recordOutcome("5.5.5.5", ["1", "2"], { ok: false, code: "MODE_CHANGED" })
  await recordOutcome("5.5.5.5", ["1", "2"], { ok: false, code: "SLOT_OTHER_ROSTER" })
  for (let i = 0; i < 4; i++) {
    await recordOutcome("5.5.5.5", ["1", "2"], { ok: false, code: "SLOT_UNAVAILABLE" })
  }
  expect(await isBlocked("5.5.5.5")).toBe(false)
  await recordOutcome("5.5.5.5", ["1", "2"], { ok: false, code: "SLOT_UNAVAILABLE" })
  expect(await isBlocked("5.5.5.5")).toBe(true)
})
