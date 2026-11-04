import { expect, test } from "vitest"

import {
  formatDateRange,
  formatDay,
  formatDayTime,
  formatSlotTime,
  formatSlotWhen,
  slotNumber,
} from "./time"

const at = (iso: string) => new Date(`${iso}T10:00:00Z`)
const now = at("2026-10-08")

test("zakres dat: jeden dzień, ten sam miesiąc, przełom miesięcy, inny rok", () => {
  expect(formatDateRange(at("2026-10-28"), at("2026-10-28"), now)).toBe("28 paź")
  expect(formatDateRange(at("2026-10-07"), at("2026-10-10"), now)).toBe("7–10 paź")
  expect(formatDateRange(at("2026-09-30"), at("2026-10-02"), now)).toBe("30 wrz – 2 paź")
  expect(formatDateRange(at("2026-10-05"), at("2030-10-05"), now)).toBe("5 paź – 5 paź 2030")
})

test("dzień i godziny slotu w czasie polskim", () => {
  const startsAt = new Date("2026-10-06T07:00:00Z")
  const endsAt = new Date("2026-10-06T07:20:00Z")
  expect(formatDay(startsAt)).toBe("wtorek 6 października")
  expect(formatDayTime(startsAt)).toBe("wtorek 6 października, 9:00")
  expect(formatSlotTime({ startsAt, endsAt })).toBe("09:00–09:20")
})

const slot = (iso: string) => ({ startsAt: new Date(iso) })

test("numer slotu: od 1 w każdym dniu, wszystkie listy razem, wejście nieposortowane", () => {
  const slots = [
    slot("2026-10-07T07:00:00Z"), // środa 9:00
    slot("2026-10-06T07:40:00Z"), // wtorek 9:40, inna lista indeksów
    slot("2026-10-06T07:00:00Z"), // wtorek 9:00
    slot("2026-10-06T07:20:00Z"), // wtorek 9:20
  ]
  expect(slotNumber(slots, new Date("2026-10-06T07:00:00Z"))).toBe(1)
  expect(slotNumber(slots, new Date("2026-10-06T07:40:00Z"))).toBe(3)
  expect(slotNumber(slots, new Date("2026-10-07T07:00:00Z"))).toBe(1)
})

test("numer slotu: slot spoza listy (nieodświeżony harmonogram) nie dostaje 0 ani numeru za mały", () => {
  const slots = [slot("2026-10-06T07:00:00Z")] // wtorek 9:00
  expect(slotNumber(slots, new Date("2026-10-06T07:20:00Z"))).toBe(2)
  expect(slotNumber(slots, new Date("2026-10-07T07:00:00Z"))).toBe(1)
})

test("numer slotu: granica dnia liczona w czasie polskim", () => {
  const slots = [
    slot("2026-10-06T07:00:00Z"), // wtorek 9:00
    slot("2026-10-06T21:40:00Z"), // wtorek 23:40
    slot("2026-10-06T22:00:00Z"), // środa 0:00
  ]
  expect(slotNumber(slots, new Date("2026-10-06T21:40:00Z"))).toBe(2)
  expect(slotNumber(slots, new Date("2026-10-06T22:00:00Z"))).toBe(1)
})

test("kiedy slot: z godziną albo z numerem slotu", () => {
  const startsAt = new Date("2026-10-06T07:40:00Z")
  const slots = [
    slot("2026-10-06T07:00:00Z"),
    slot("2026-10-06T07:20:00Z"),
    slot("2026-10-06T07:40:00Z"),
  ]
  expect(formatSlotWhen(startsAt, null)).toBe("wtorek 6 października, 9:40")
  expect(formatSlotWhen(startsAt, slots)).toBe("wtorek 6 października, slot 3")
})
