import { expect, test } from "vitest"

import { isEnrollmentOpen, isFreeSlot } from "./schedule"

const now = new Date("2026-10-05T08:00:00Z")
const later = new Date("2026-10-05T09:00:00Z")
const earlier = new Date("2026-10-05T07:00:00Z")

test("wolny slot: bez zespołu i jeszcze się nie zaczął", () => {
  expect(isFreeSlot({ startsAt: later }, 0, now)).toBe(true)
  expect(isFreeSlot({ startsAt: earlier }, 0, now)).toBe(false)
  expect(isFreeSlot({ startsAt: now }, 0, now)).toBe(false)
  expect(isFreeSlot({ startsAt: later }, 1, now)).toBe(false)
})

test("zapisy otwarte bez daty startu albo od chwili startu", () => {
  expect(isEnrollmentOpen(null, now)).toBe(true)
  expect(isEnrollmentOpen(now, now)).toBe(true)
  expect(isEnrollmentOpen(later, now)).toBe(false)
})
