import { expect, test } from "vitest"

import { examPhase, isEnrollmentOpen, isFreeSlot } from "./schedule"

const now = new Date("2026-10-05T08:00:00Z")
const later = new Date("2026-10-05T09:00:00Z")
const earlier = new Date("2026-10-05T07:00:00Z")

test("wolny slot: bez zespołu i jeszcze się nie zaczął", () => {
  expect(isFreeSlot({ startsAt: later }, false, now)).toBe(true)
  expect(isFreeSlot({ startsAt: earlier }, false, now)).toBe(false)
  expect(isFreeSlot({ startsAt: now }, false, now)).toBe(false)
  expect(isFreeSlot({ startsAt: later }, true, now)).toBe(false)
})

test("zapisy otwarte bez daty startu albo od chwili startu", () => {
  expect(isEnrollmentOpen(null, now)).toBe(true)
  expect(isEnrollmentOpen(now, now)).toBe(true)
  expect(isEnrollmentOpen(later, now)).toBe(false)
})

test("etap zaliczenia: przygotowanie, przed zapisami, w trakcie, zakończone", () => {
  const ready = { entries: 10, lastSlotEnd: later, opensAt: null }
  expect(examPhase({ ...ready, entries: 0 }, now)).toBe("draft")
  expect(examPhase({ ...ready, lastSlotEnd: null }, now)).toBe("draft")
  expect(examPhase({ ...ready, opensAt: later }, now)).toBe("scheduled")
  expect(examPhase(ready, now)).toBe("open")
  expect(examPhase({ ...ready, opensAt: earlier }, now)).toBe("open")
  expect(examPhase({ ...ready, lastSlotEnd: earlier }, now)).toBe("done")
})
