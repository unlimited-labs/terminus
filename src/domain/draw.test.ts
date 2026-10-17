import { describe, expect, test } from "vitest"

import { planChoice, planEnrollment, planLookup, type EnrollmentData } from "./draw"

const now = new Date("2026-10-01T08:00:00Z")

function data(overrides: Partial<EnrollmentData> = {}): EnrollmentData {
  return {
    maxTeamSize: 3,
    entries: [
      { studentNumber: "100", rosterId: "g1" },
      { studentNumber: "101", rosterId: "g1" },
      { studentNumber: "102", rosterId: "g1" },
      { studentNumber: "200", rosterId: "g2" },
    ],
    slots: [
      { id: "past", rosterId: "g1", startsAt: new Date("2026-10-01T07:00:00Z") },
      { id: "d1a", rosterId: "g1", startsAt: new Date("2026-10-01T09:00:00Z") },
      { id: "d1b", rosterId: "g1", startsAt: new Date("2026-10-01T10:00:00Z") },
      { id: "d1c", rosterId: "g1", startsAt: new Date("2026-10-01T11:00:00Z") },
      { id: "d2a", rosterId: "g1", startsAt: new Date("2026-10-02T09:00:00Z") },
      { id: "g2a", rosterId: "g2", startsAt: new Date("2026-10-03T09:00:00Z") },
    ],
    enrollments: [],
    ...overrides,
  }
}

const first = () => 0
const last = (max: number) => max - 1

describe("planEnrollment", () => {
  test("przed startem zapisów nic nie jest sprawdzane ani losowane", () => {
    const opensAt = new Date("2026-10-01T10:00:00Z")
    expect(planEnrollment(data({ opensAt }), ["100"], now, first)).toEqual({
      ok: false,
      code: "NOT_OPEN_YET",
      opensAt,
    })
    expect(planEnrollment(data({ opensAt: now }), ["100"], now, first)).toMatchObject({ ok: true })
  })

  test("pusty zapis to brak danych", () => {
    expect(planEnrollment(data(), [], now, first)).toEqual({ ok: false, code: "NO_INPUT" })
  })

  test("za duży zespół", () => {
    expect(planEnrollment(data({ maxTeamSize: 2 }), ["100", "101", "102"], now, first)).toEqual({
      ok: false,
      code: "TEAM_TOO_LARGE",
      maxTeamSize: 2,
    })
  })

  test("ten sam indeks dwa razy", () => {
    expect(planEnrollment(data(), ["100", "101", "100"], now, first)).toEqual({
      ok: false,
      code: "DUPLICATE_NUMBER",
      studentNumbers: ["100"],
    })
  })

  test("indeksu nie ma na liście", () => {
    expect(planEnrollment(data(), ["100", "999"], now, first)).toEqual({
      ok: false,
      code: "NOT_ON_ROSTER",
      studentNumbers: ["999"],
    })
  })

  test("indeks ma już zapis: podaje początek jego slotu, nie losuje", () => {
    const result = planEnrollment(
      data({ enrollments: [{ studentNumber: "101", slotId: "d2a" }] }),
      ["100", "101"],
      now,
      first,
    )
    expect(result).toEqual({
      ok: false,
      code: "ALREADY_ENROLLED",
      enrolled: [{ studentNumber: "101", startsAt: new Date("2026-10-02T09:00:00Z") }],
    })
  })

  test("członek zespołu z innej listy", () => {
    expect(planEnrollment(data(), ["100", "200"], now, first)).toEqual({
      ok: false,
      code: "DIFFERENT_ROSTER",
      studentNumbers: ["200"],
    })
  })

  test("brak wolnych slotów", () => {
    const enrollments = ["d1a", "d1b", "d1c", "d2a"].map((slotId, i) => ({
      studentNumber: `x${i}`,
      slotId,
    }))
    expect(planEnrollment(data({ enrollments }), ["100"], now, first)).toEqual({
      ok: false,
      code: "NO_FREE_SLOTS",
    })
  })

  test("losuje tylko wolne, przyszłe sloty listy zespołu", () => {
    const enrollments = [{ studentNumber: "x", slotId: "d1a" }]
    const seen = new Set<string>()
    for (let day = 0; day < 2; day++) {
      for (let slot = 0; slot < 2; slot++) {
        const picks = [day, slot]
        const result = planEnrollment(data({ enrollments }), ["100"], now, (max) =>
          Math.min(picks.shift() ?? 0, max - 1),
        )
        if (result.ok) seen.add(result.slotId)
      }
    }
    expect([...seen].toSorted()).toEqual(["d1b", "d1c", "d2a"])
  })

  test("najpierw dzień z równą szansą, potem slot w dniu", () => {
    const calls: number[] = []
    const random = (max: number) => {
      calls.push(max)
      return max - 1
    }
    const result = planEnrollment(data(), ["100", "101"], now, random)
    expect(calls).toEqual([2, 1])
    expect(result).toEqual({ ok: true, slotId: "d2a" })
    expect(planEnrollment(data(), ["100"], now, last)).toEqual({ ok: true, slotId: "d2a" })
  })

  test("dzień liczony w strefie Europe/Warsaw", () => {
    const slots = [
      { id: "late", rosterId: "g1", startsAt: new Date("2026-10-01T22:30:00Z") },
      { id: "early", rosterId: "g1", startsAt: new Date("2026-10-02T06:00:00Z") },
    ]
    const calls: number[] = []
    planEnrollment(data({ slots }), ["100"], now, (max) => {
      calls.push(max)
      return 0
    })
    expect(calls).toEqual([1, 2])
  })
})

describe("planChoice", () => {
  test("wolny slot listy zespołu zostaje wybrany bez losowania", () => {
    expect(planChoice(data(), ["100", "101"], "d1b", now)).toEqual({ ok: true, slotId: "d1b" })
  })

  test("wspólne sprawdzenia jak przy losowaniu", () => {
    const opensAt = new Date("2026-10-01T10:00:00Z")
    expect(planChoice(data({ opensAt }), ["100"], "d1a", now)).toMatchObject({
      code: "NOT_OPEN_YET",
    })
    expect(planChoice(data(), [], "d1a", now)).toEqual({ ok: false, code: "NO_INPUT" })
    expect(planChoice(data({ maxTeamSize: 1 }), ["100", "101"], "d1a", now)).toMatchObject({
      code: "TEAM_TOO_LARGE",
    })
    expect(planChoice(data(), ["999"], "d1a", now)).toEqual({
      ok: false,
      code: "NOT_ON_ROSTER",
      studentNumbers: ["999"],
    })
    expect(planChoice(data(), ["100", "200"], "d1a", now)).toMatchObject({
      code: "DIFFERENT_ROSTER",
    })
    const enrollments = [{ studentNumber: "100", slotId: "d1c" }]
    expect(planChoice(data({ enrollments }), ["100"], "d1a", now)).toMatchObject({
      code: "ALREADY_ENROLLED",
    })
  })

  test("zajęty slot jest niedostępny, bez dołączania do cudzego zespołu", () => {
    const enrollments = [{ studentNumber: "102", slotId: "d1a" }]
    expect(planChoice(data({ enrollments }), ["100"], "d1a", now)).toEqual({
      ok: false,
      code: "SLOT_UNAVAILABLE",
    })
  })

  test("rozpoczęty slot jest niedostępny", () => {
    expect(planChoice(data(), ["100"], "past", now)).toEqual({
      ok: false,
      code: "SLOT_UNAVAILABLE",
    })
  })

  test("slot spoza zaliczenia jest niedostępny, bez zdradzania czegokolwiek", () => {
    expect(planChoice(data(), ["100"], "nie-moj", now)).toEqual({
      ok: false,
      code: "SLOT_UNAVAILABLE",
    })
  })

  test("slot innej listy niż zespół", () => {
    expect(planChoice(data(), ["100"], "g2a", now)).toEqual({
      ok: false,
      code: "SLOT_OTHER_ROSTER",
      slotRosterId: "g2",
      teamRosterId: "g1",
    })
  })
})

describe("planLookup", () => {
  test("po sprawdzeniu zespołu nigdy nie przydziela slotu", () => {
    expect(planLookup(data(), ["100"], now)).toEqual({ ok: false, code: "NO_FREE_SLOTS" })
    expect(planLookup(data(), ["999"], now)).toMatchObject({ code: "NOT_ON_ROSTER" })
    const enrollments = [{ studentNumber: "100", slotId: "d1a" }]
    expect(planLookup(data({ enrollments }), ["100"], now)).toMatchObject({
      code: "ALREADY_ENROLLED",
    })
  })
})
