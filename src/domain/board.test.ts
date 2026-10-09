import { describe, expect, test } from "vitest"

import {
  applyCommand,
  changedPeople,
  dropCommand,
  enqueue,
  parseDragId,
  settle,
  type BoardCommand,
  type BoardQueue,
  type BoardState,
} from "./board"
import type { Answers } from "./fields"

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
const answersOf = (s: BoardState, n: string) => s.people.find((p) => p.studentNumber === n)?.answers

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

  describe("odpowiedzi zespołu", () => {
    const titles: Record<string, string> = { s1: "Robot", s2: "Dron" }
    const answered: BoardState = {
      ...state,
      people: state.people.map((p) => {
        const answers: Answers = p.slotId ? { t: titles[p.slotId]! } : {}
        return { ...p, answers }
      }),
    }

    function next(command: BoardCommand, from = answered) {
      const result = applyCommand(from, command)
      if (!result.ok) throw new Error(result.code)
      return result.state
    }

    test("dołączający do zespołu przejmuje jego odpowiedzi", () => {
      expect(answersOf(next({ kind: "move", studentNumber: "4", toSlotId: "s2" }), "4")).toEqual({
        t: "Dron",
      })
    })

    test("zamiana osób: dołączający przejmuje odpowiedzi, kto trafia do opuszczonego slotu, zachowuje swoje", () => {
      const s = next({ kind: "swapPeople", a: "3", b: "1" })
      expect([answersOf(s, "1"), answersOf(s, "3")]).toEqual([{ t: "Robot" }, { t: "Robot" }])
    })

    test("osoba sama w slocie przenosi swoje odpowiedzi do pustego slotu", () => {
      expect(answersOf(next({ kind: "move", studentNumber: "3", toSlotId: "s3" }), "3")).toEqual({
        t: "Dron",
      })
    })

    test("przeniesiony cały zespół zachowuje swoje odpowiedzi", () => {
      const s = next({ kind: "swapSlots", a: "s1", b: "s2" })
      expect([answersOf(s, "1"), answersOf(s, "2"), answersOf(s, "3")]).toEqual([
        { t: "Robot" },
        { t: "Robot" },
        { t: "Dron" },
      ])
    })

    test("zmiana odpowiedzi zespołu dotyczy całego zespołu; Cofnij przywraca poprzednie", () => {
      const result = applyCommand(answered, {
        kind: "setAnswers",
        slotId: "s1",
        answers: { t: "Łazik" },
      })
      if (!result.ok) throw new Error(result.code)
      expect([
        answersOf(result.state, "1"),
        answersOf(result.state, "2"),
        answersOf(result.state, "3"),
      ]).toEqual([{ t: "Łazik" }, { t: "Łazik" }, { t: "Dron" }])
      expect(result.inverse).toEqual({ kind: "setAnswers", slotId: "s1", answers: { t: "Robot" } })
    })

    test("zmiana odpowiedzi: pusty slot, te same odpowiedzi, nieznany slot", () => {
      const cases: [string, Answers, string][] = [
        ["s3", { t: "x" }, "NOT_ENROLLED"],
        ["s1", { t: "Robot" }, "NO_CHANGE"],
        ["x", { t: "x" }, "SLOT_NOT_FOUND"],
      ]
      for (const [slotId, answers, code] of cases)
        expect(applyCommand(answered, { kind: "setAnswers", slotId, answers })).toEqual({
          ok: false,
          code,
        })
    })

    test("Cofnij wypisania osoby, gdy jej zespół istnieje: odpowiedzi zespołu wygrywają", () => {
      const removed = applyCommand(answered, { kind: "move", studentNumber: "1", toSlotId: null })
      if (!removed.ok) throw new Error(removed.code)
      const edited: BoardState = {
        ...removed.state,
        people: removed.state.people.map((p) =>
          p.studentNumber === "2" ? { ...p, answers: { t: "Nowy" } } : p,
        ),
      }
      expect(answersOf(next(removed.inverse, edited), "1")).toEqual({ t: "Nowy" })
    })
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

function queued(...commands: BoardCommand[]) {
  let queue: BoardQueue<BoardState> = null
  let shown: BoardState = state
  for (const command of commands) {
    const added: ReturnType<typeof enqueue<BoardState>> = enqueue(queue, shown, command)
    if (!added.ok) throw new Error(added.code)
    queue = added.queue
    shown = added.shown
  }
  return { queue: queue!, shown }
}

describe("kolejka poleceń tablicy", () => {
  const toS3: BoardCommand = { kind: "move", studentNumber: "4", toSlotId: "s3" }
  const alsoS3: BoardCommand = { kind: "move", studentNumber: "3", toSlotId: "s3" }

  test("dodane polecenie widać od razu", () => {
    expect(slotOf(queued(toS3).shown, "4")).toBe("s3")
  })

  test("polecenie odrzucone od razu nie trafia do kolejki", () => {
    expect(enqueue(null, state, { kind: "move", studentNumber: "3", toSlotId: "s1" })).toEqual({
      ok: false,
      code: "SLOT_FULL",
    })
  })

  test("nieudane pierwsze z dwóch: widać stan sprzed kolejki z drugim poleceniem", () => {
    const { queue } = queued(toS3, alsoS3)
    const after = settle(queue, toS3)
    expect([slotOf(after.shown, "4"), slotOf(after.shown, "3")]).toEqual([null, "s3"])
    expect(after.queue?.pending).toEqual([alsoS3])
  })

  test("stan z serwera w trakcie kolejki: reszta poleceń nałożona na niego", () => {
    const { queue } = queued(toS3, alsoS3)
    const server = applyOk(applyOk(state, toS3), {
      kind: "rename",
      studentNumber: "1",
      firstName: "Ania",
      lastName: "A",
    })
    const after = settle(queue, toS3, server)
    expect(slotOf(after.shown, "3")).toBe("s3")
    expect(after.shown.people[0]!.firstName).toBe("Ania")
  })

  test("ostatnie rozliczone polecenie opróżnia kolejkę", () => {
    const { queue } = queued(toS3)
    const server = applyOk(state, toS3)
    expect(settle(queue, toS3, server)).toEqual({ queue: null, shown: server })
  })

  test("Cofnij po nieudanym poleceniu wraca do stanu sprzed udanego", () => {
    const { queue } = queued(toS3, alsoS3)
    const done = applyCommand(state, toS3)
    if (!done.ok) throw new Error(done.code)
    const afterOk = settle(queue, toS3, done.state)
    const afterFail = settle(afterOk.queue!, alsoS3)
    expect(afterFail.queue).toBeNull()
    const undo = enqueue(afterFail.queue, afterFail.shown, done.inverse)
    if (!undo.ok) throw new Error(undo.code)
    expect(undo.shown).toEqual(state)
  })

  test("zmiana odpowiedzi w trakcie przesuwania obejmuje dołączającego", () => {
    const join: BoardCommand = { kind: "move", studentNumber: "4", toSlotId: "s2" }
    const edit: BoardCommand = { kind: "setAnswers", slotId: "s2", answers: { t: "Dron" } }
    const { queue } = queued(join, edit)
    const after = settle(queue, join, applyOk(state, join))
    expect([answersOf(after.shown, "3"), answersOf(after.shown, "4")]).toEqual([
      { t: "Dron" },
      { t: "Dron" },
    ])
  })
})

test("changedPeople zwraca pary [przed, po] osób ze zmienionym slotem lub nazwiskiem", () => {
  const result = applyCommand(state, { kind: "swapPeople", a: "1", b: "3" })
  if (!result.ok) throw new Error(result.code)
  const pairs = changedPeople(state, result.state).map(([prev, next]) => [
    prev.studentNumber,
    next.studentNumber,
    prev.slotId,
    next.slotId,
  ])
  expect(pairs).toEqual([
    ["1", "1", slotOf(state, "1"), slotOf(state, "3")],
    ["3", "3", slotOf(state, "3"), slotOf(state, "1")],
  ])
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
