import { expect, test } from "vitest"

import {
  examPhase,
  fullName,
  isEnrollmentOpen,
  isFreeSlot,
  msUntilOpen,
  receivedAt,
} from "./schedule"

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

test("czas do otwarcia zapisów: brak, gdy otwarte; limit setTimeout przy dalekiej dacie", () => {
  expect(msUntilOpen(null, now)).toBeNull()
  expect(msUntilOpen(earlier, now)).toBeNull()
  expect(msUntilOpen(later, now)).toBe(3_600_000)
  expect(msUntilOpen(new Date("2027-10-05T08:00:00Z"), now)).toBe(2_147_483_647)
})

test("czas do otwarcia odejmuje czas od odebrania danych; po czasie pobranie od razu", () => {
  expect(msUntilOpen(later, now, 600_000)).toBe(3_000_000)
  expect(msUntilOpen(later, now, 3_600_000)).toBe(0)
  expect(msUntilOpen(later, now, 5_000_000)).toBe(0)
  expect(msUntilOpen(earlier, now, 600_000)).toBeNull()
})

test("chwila odebrania: pobranie w przeglądarce bez zmian, znacznik serwera w [pierwszy bajt, teraz]", () => {
  const firstByte = 1_000
  const at = 5_000
  expect(receivedAt(3_000, firstByte, at)).toBe(3_000)
  expect(receivedAt(400, firstByte, at)).toBe(firstByte)
  expect(receivedAt(9_000, firstByte, at)).toBe(at)
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

test("pełne imię: imię, potem nazwisko", () => {
  expect(fullName({ firstName: "Anna", lastName: "Nowak" })).toBe("Anna Nowak")
})
