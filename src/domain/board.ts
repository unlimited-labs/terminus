export type BoardPerson = {
  studentNumber: string
  slotId: string | null
  firstName: string
  lastName: string
}

export type BoardState<P extends BoardPerson = BoardPerson> = {
  maxTeamSize: number
  slots: { id: string }[]
  people: P[]
}

/** `toSlotId: null` to panel "Niezapisani". */
export type BoardCommand =
  | { kind: "move"; studentNumber: string; toSlotId: string | null }
  | { kind: "swapPeople"; a: string; b: string }
  | { kind: "swapSlots"; a: string; b: string }
  | { kind: "rename"; studentNumber: string; firstName: string; lastName: string }

export type BoardErrorCode =
  | "SLOT_FULL"
  | "SLOT_NOT_FOUND"
  | "PERSON_NOT_FOUND"
  | "NOT_ENROLLED"
  | "NO_CHANGE"

export type BoardResult<S> =
  | { ok: true; state: S; inverse: BoardCommand }
  | { ok: false; code: BoardErrorCode }

type Step<P> = { people: P[]; inverse: BoardCommand } | BoardErrorCode
type Command<K extends BoardCommand["kind"]> = Extract<BoardCommand, { kind: K }>

const teamSize = (s: BoardState, slotId: string) =>
  s.people.filter((p) => p.slotId === slotId).length
const hasSlot = (s: BoardState, id: string) => s.slots.some((slot) => slot.id === id)
const findPerson = <P extends BoardPerson>(s: BoardState<P>, n: string) =>
  s.people.find((p) => p.studentNumber === n)

function move<P extends BoardPerson>(s: BoardState<P>, c: Command<"move">): Step<P> {
  const p = findPerson(s, c.studentNumber)
  if (!p) return "PERSON_NOT_FOUND"
  const to = c.toSlotId
  if (to !== null && !hasSlot(s, to)) return "SLOT_NOT_FOUND"
  if (p.slotId === to) return "NO_CHANGE"
  if (to !== null && teamSize(s, to) >= s.maxTeamSize) return "SLOT_FULL"
  return {
    people: s.people.map((q) => (q === p ? { ...q, slotId: to } : q)),
    inverse: { kind: "move", studentNumber: p.studentNumber, toSlotId: p.slotId },
  }
}

function swapPeople<P extends BoardPerson>(s: BoardState<P>, c: Command<"swapPeople">): Step<P> {
  const a = findPerson(s, c.a)
  const b = findPerson(s, c.b)
  if (!a || !b) return "PERSON_NOT_FOUND"
  if (a.slotId === null || b.slotId === null) return "NOT_ENROLLED"
  if (a.slotId === b.slotId) return "NO_CHANGE"
  const swapped = new Map([
    [a, b.slotId],
    [b, a.slotId],
  ])
  return {
    people: s.people.map((q) => (swapped.has(q) ? { ...q, slotId: swapped.get(q)! } : q)),
    inverse: c,
  }
}

function swapSlots<P extends BoardPerson>(
  s: BoardState<P>,
  { a, b }: Command<"swapSlots">,
): Step<P> {
  if (!hasSlot(s, a) || !hasSlot(s, b)) return "SLOT_NOT_FOUND"
  if (a === b || teamSize(s, a) === 0) return "NO_CHANGE"
  const target = (slotId: string | null) => (slotId === a ? b : slotId === b ? a : slotId)
  return {
    people: s.people.map((q) => ({ ...q, slotId: target(q.slotId) })),
    inverse: { kind: "swapSlots", a: b, b: a },
  }
}

function rename<P extends BoardPerson>(s: BoardState<P>, c: Command<"rename">): Step<P> {
  const p = findPerson(s, c.studentNumber)
  if (!p) return "PERSON_NOT_FOUND"
  if (p.firstName === c.firstName && p.lastName === c.lastName) return "NO_CHANGE"
  return {
    people: s.people.map((q) =>
      q === p ? { ...q, firstName: c.firstName, lastName: c.lastName } : q,
    ),
    inverse: { ...c, firstName: p.firstName, lastName: p.lastName },
  }
}

function step<P extends BoardPerson>(s: BoardState<P>, c: BoardCommand): Step<P> {
  switch (c.kind) {
    case "move":
      return move(s, c)
    case "swapPeople":
      return swapPeople(s, c)
    case "swapSlots":
      return swapSlots(s, c)
    case "rename":
      return rename(s, c)
  }
}

export function applyCommand<P extends BoardPerson, S extends BoardState<P>>(
  state: S,
  command: BoardCommand,
): BoardResult<S> {
  const result = step(state, command)
  if (typeof result === "string") return { ok: false, code: result }
  return { ok: true, state: { ...state, people: result.people }, inverse: result.inverse }
}

export function changedPeople<P extends BoardPerson>(
  before: BoardState<P>,
  after: BoardState<P>,
): P[] {
  const old = new Map(before.people.map((p) => [p.studentNumber, p]))
  return after.people.filter((p) => {
    const o = old.get(p.studentNumber)
    return !o || o.slotId !== p.slotId || o.firstName !== p.firstName || o.lastName !== p.lastName
  })
}
