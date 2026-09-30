import { describe, expect, test } from "vitest"

import { cutWindow, findOverlap } from "./slots"

describe("cutWindow", () => {
  test("tnie okno na sloty, reszta przepada", () => {
    const result = cutWindow({ date: "2026-10-05", from: "09:00", to: "12:00", minutes: 25 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.slots).toHaveLength(7)
    expect(result.slots[0]).toEqual({
      startsAt: new Date("2026-10-05T07:00:00Z"),
      endsAt: new Date("2026-10-05T07:25:00Z"),
    })
    expect(result.slots[6]!.endsAt).toEqual(new Date("2026-10-05T09:55:00Z"))
    expect(result.unusedMinutes).toBe(5)
  })

  test("czas polski zimą (UTC+1)", () => {
    const result = cutWindow({ date: "2026-12-01", from: "08:00", to: "08:30", minutes: 30 })
    expect(result).toEqual({
      ok: true,
      slots: [
        { startsAt: new Date("2026-12-01T07:00:00Z"), endsAt: new Date("2026-12-01T07:30:00Z") },
      ],
      unusedMinutes: 0,
    })
  })

  test('"do" musi być później niż "od"', () => {
    expect(cutWindow({ date: "2026-10-05", from: "12:00", to: "12:00", minutes: 15 })).toEqual({
      ok: false,
      code: "WINDOW_END_BEFORE_START",
    })
  })

  test("okno krótsze niż jeden slot jest odrzucane", () => {
    expect(cutWindow({ date: "2026-10-05", from: "12:00", to: "12:10", minutes: 15 })).toEqual({
      ok: false,
      code: "WINDOW_TOO_SHORT",
    })
  })
})

describe("findOverlap", () => {
  const existing = [
    {
      id: "a",
      startsAt: new Date("2026-10-05T07:00:00Z"),
      endsAt: new Date("2026-10-05T07:30:00Z"),
    },
  ]

  test("stykanie się jest dozwolone", () => {
    const touching = [
      { startsAt: new Date("2026-10-05T07:30:00Z"), endsAt: new Date("2026-10-05T08:00:00Z") },
      { startsAt: new Date("2026-10-05T06:30:00Z"), endsAt: new Date("2026-10-05T07:00:00Z") },
    ]
    expect(findOverlap(touching, existing)).toBeUndefined()
  })

  test("zwraca pierwszy kolidujący slot", () => {
    const overlapping = [
      { startsAt: new Date("2026-10-05T07:29:00Z"), endsAt: new Date("2026-10-05T08:00:00Z") },
    ]
    expect(findOverlap(overlapping, existing)).toBe(existing[0])
  })

  test("pomija slot o podanym id (edycja godziny slotu)", () => {
    const moved = [
      { startsAt: new Date("2026-10-05T07:10:00Z"), endsAt: new Date("2026-10-05T07:40:00Z") },
    ]
    expect(findOverlap(moved, existing, "a")).toBeUndefined()
  })
})
