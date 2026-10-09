import { describe, expect, test } from "vitest"

import {
  applyCommand,
  changedPeople,
  dropCommand,
  parseDragId,
  type BoardCommand,
  type BoardState,
} from "./board"

const state: BoardState = {
  maxTeamSize: 2,
  slots: [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "other-roster" }],
  people: [
    { studentNumber: "1", slotId: "s1", firstName: "Anna", lastName: "A" },
    { studentNumber: "2", slotId: "s1", firstName: "Bartek", lastName: "B" },
    { studentNumber: "3", slotId: "s2", firstName: "Celina", lastName: "C" },
    { studentNumber: "4", slotId: null, firstName: "Damian", lastName: "D" },
  ],
}

const slotOf = (s: BoardState, n: string) => s.people.find((p) => p.studentNumber === n)?.slotId

function applyOk(s: BoardState, command: BoardCommand) {
  const result = applyCommand(s, command)
  if (!result.ok) throw new Error(result.code)
  const undone = applyCommand(result.state, result.inverse)
  if (!undone.ok) throw new Error(undone.code)
  expect(undone.state).toEqual(s)
  return result.state
}

describe("applyCommand", () => {
  test("wypisanie: polecenie odwrotne niesie odpowiedzi; zapis z odpowiedziami je ustawia", () => {
    const withAnswers: BoardState = {
      ...state,
      people: state.people.map((p) =>
        p.studentNumber === "3" ? { ...p, answers: { title: "Robot" } } : p,
      ),
    }
    expect(
      applyCommand(withAnswers, { kind: "move", studentNumber: "3", toSlotId: null }),
    ).toMatchObject({
      ok: true,
      inverse: { kind: "move", studentNumber: "3", toSlotId: "s2", answers: { title: "Robot" } },
    })

    const back = applyCommand(state, {
      kind: "move",
      studentNumber: "4",
      toSlotId: "s3",
      answers: { title: "Dron" },
    })
    if (!back.ok) throw new Error(back.code)
    expect(back.state.people.find((p) => p.studentNumber === "4")?.answers).toEqual({
      title: "Dron",
    })
    expect(back.inverse).toEqual({ kind: "move", studentNumber: "4", toSlotId: null })
  })

  test("osoba → slot z wolnym miejscem: przeniesienie (Cofnij wraca)", () => {
    expect(slotOf(applyOk(state, { kind: "move", studentNumber: "1", toSlotId: "s2" }), "1")).toBe(
      "s2",
    )
  })

  test("osoba → pełny slot: odrzucone", () => {
    expect(applyCommand(state, { kind: "move", studentNumber: "3", toSlotId: "s1" })).toEqual({
      ok: false,
      code: "SLOT_FULL",
    })
  })

  test("osoba → slot cudzej listy: dozwolone", () => {
    const next = applyOk(state, { kind: "move", studentNumber: "3", toSlotId: "other-roster" })
    expect(slotOf(next, "3")).toBe("other-roster")
  })

  test('osoba → "Niezapisani": usunięcie zapisu', () => {
    expect(
      slotOf(applyOk(state, { kind: "move", studentNumber: "3", toSlotId: null }), "3"),
    ).toBeNull()
  })

  test('"Niezapisany" → slot z wolnym miejscem: ręczny zapis', () => {
    expect(slotOf(applyOk(state, { kind: "move", studentNumber: "4", toSlotId: "s3" }), "4")).toBe(
      "s3",
    )
  })

  test("upuszczenie w tym samym miejscu nic nie zmienia", () => {
    expect(applyCommand(state, { kind: "move", studentNumber: "1", toSlotId: "s1" })).toEqual({
      ok: false,
      code: "NO_CHANGE",
    })
  })

  test("nieznany slot lub osoba", () => {
    expect(applyCommand(state, { kind: "move", studentNumber: "1", toSlotId: "x" })).toEqual({
      ok: false,
      code: "SLOT_NOT_FOUND",
    })
    expect(applyCommand(state, { kind: "move", studentNumber: "x", toSlotId: "s3" })).toEqual({
      ok: false,
      code: "PERSON_NOT_FOUND",
    })
  })

  test("osoba → inna osoba: zamiana slotów", () => {
    const next = applyOk(state, { kind: "swapPeople", a: "1", b: "3" })
    expect([slotOf(next, "1"), slotOf(next, "3")]).toEqual(["s2", "s1"])
  })

  test("niezapisany → osoba: odrzucone", () => {
    expect(applyCommand(state, { kind: "swapPeople", a: "4", b: "1" })).toEqual({
      ok: false,
      code: "NOT_ENROLLED",
    })
  })

  test("zamiana osób z tego samego slotu nic nie zmienia", () => {
    expect(applyCommand(state, { kind: "swapPeople", a: "1", b: "2" })).toEqual({
      ok: false,
      code: "NO_CHANGE",
    })
  })

  test("cały zespół → wolny slot: przeniesienie", () => {
    const next = applyOk(state, { kind: "swapSlots", a: "s1", b: "s3" })
    expect([slotOf(next, "1"), slotOf(next, "2"), slotOf(next, "3")]).toEqual(["s3", "s3", "s2"])
  })

  test("cały zespół → slot z innym zespołem: zamiana zespołów", () => {
    const next = applyOk(state, { kind: "swapSlots", a: "s1", b: "s2" })
    expect([slotOf(next, "1"), slotOf(next, "2"), slotOf(next, "3")]).toEqual(["s2", "s2", "s1"])
  })

  test("pusty slot nie ma zespołu do przeniesienia", () => {
    expect(applyCommand(state, { kind: "swapSlots", a: "s3", b: "s1" })).toEqual({
      ok: false,
      code: "NO_CHANGE",
    })
  })

  test("wypisanie całego zespołu; Cofnij wraca z odpowiedziami", () => {
    const withAnswers: BoardState = {
      ...state,
      people: state.people.map((p) => (p.slotId === "s1" ? { ...p, answers: { t: "R" } } : p)),
    }
    const next = applyOk(withAnswers, { kind: "unenrollTeam", slotId: "s1" })
    expect([slotOf(next, "1"), slotOf(next, "2"), slotOf(next, "3")]).toEqual([null, null, "s2"])
    expect(applyCommand(state, { kind: "unenrollTeam", slotId: "s3" })).toEqual({
      ok: false,
      code: "NO_CHANGE",
    })
  })

  test("przywrócenie zespołu tylko do pustego slotu", () => {
    const back: BoardCommand = { kind: "enrollTeam", slotId: "s2", studentNumbers: ["4"] }
    expect(applyCommand(state, back)).toEqual({ ok: false, code: "SLOT_FULL" })
  })

  test("zmiana imienia i nazwiska", () => {
    const next = applyOk(state, {
      kind: "rename",
      studentNumber: "1",
      firstName: "Ania",
      lastName: "Nowa",
    })
    expect(next.people[0]).toMatchObject({ firstName: "Ania", lastName: "Nowa" })
  })
})

test("changedPeople zwraca osoby ze zmienionym slotem lub nazwiskiem", () => {
  const result = applyCommand(state, { kind: "swapPeople", a: "1", b: "3" })
  if (!result.ok) throw new Error(result.code)
  expect(changedPeople(state, result.state).map((p) => p.studentNumber)).toEqual(["1", "3"])
})

const person = (studentNumber: string) => ({ kind: "person", studentNumber }) as const
const slot = (slotId: string) => ({ kind: "slot", slotId }) as const
const team = (slotId: string) => ({ kind: "team", slotId }) as const

test("parseDragId", () => {
  expect(parseDragId("pt:123")).toEqual(person("123"))
  expect(parseDragId("s:a-b")).toEqual(slot("a-b"))
  expect(parseDragId("t:x")).toEqual(team("x"))
  expect(parseDragId("pool")).toEqual({ kind: "pool" })
  expect(parseDragId("?")).toBeUndefined()
})

describe("dropCommand", () => {
  test("osoba → slot / osoba / Niezapisani", () => {
    expect(dropCommand(person("1"), slot("s2"), state.people)).toEqual({
      kind: "move",
      studentNumber: "1",
      toSlotId: "s2",
    })
    expect(dropCommand(person("1"), person("3"), state.people)).toEqual({
      kind: "swapPeople",
      a: "1",
      b: "3",
    })
    expect(dropCommand(person("1"), { kind: "pool" }, state.people)).toEqual({
      kind: "move",
      studentNumber: "1",
      toSlotId: null,
    })
    expect(dropCommand(person("1"), person("1"), state.people)).toBeNull()
  })

  test("zespół → slot albo na osobę w innym slocie", () => {
    expect(dropCommand(team("s1"), slot("s3"), state.people)).toEqual({
      kind: "swapSlots",
      a: "s1",
      b: "s3",
    })
    expect(dropCommand(team("s1"), person("3"), state.people)).toEqual({
      kind: "swapSlots",
      a: "s1",
      b: "s2",
    })
    expect(dropCommand(team("s1"), person("2"), state.people)).toBeNull()
    expect(dropCommand(team("s1"), { kind: "pool" }, state.people)).toEqual({
      kind: "unenrollTeam",
      slotId: "s1",
    })
  })
})
