import { expect, test } from "vitest"

import { isFreeSlot } from "./schedule"

const now = new Date("2026-10-05T08:00:00Z")

test("wolny slot: bez zespołu i jeszcze się nie zaczął", () => {
  expect(isFreeSlot({ startsAt: new Date("2026-10-05T09:00:00Z"), team: [] }, now)).toBe(true)
  expect(isFreeSlot({ startsAt: new Date("2026-10-05T07:00:00Z"), team: [] }, now)).toBe(false)
  expect(isFreeSlot({ startsAt: now, team: [] }, now)).toBe(false)
  expect(isFreeSlot({ startsAt: new Date("2026-10-05T09:00:00Z"), team: [{}] }, now)).toBe(false)
})
