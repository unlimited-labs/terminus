import type { Answers } from "./fields.ts"

export type BoardPerson = {
  studentNumber: string
  slotId: string | null
  firstName: string
  lastName: string
  answers?: Answers
}

export type BoardState<P extends BoardPerson = BoardPerson> = {
  maxTeamSize: number
  slots: { id: string }[]
  people: P[]
}

/** `toSlotId: null` to panel "Niezapisani"; `answers` niesie Cofnij wypisania. */
export type BoardCommand =
  | { kind: "move"; studentNumber: string; toSlotId: string | null; answers?: Answers }
  | { kind: "swapPeople"; a: string; b: string }
  | { kind: "swapSlots"; a: string; b: string }
  | { kind: "rename"; studentNumber: string; firstName: string; lastName: string }
  | { kind: "unenrollTeam"; slotId: string }
  | { kind: "enrollTeam"; slotId: string; studentNumbers: string[]; answers?: Answers }

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
    people: s.people.map((q) =>
      q === p ? { ...q, slotId: to, ...(c.answers && { answers: c.answers }) } : q,
    ),
    inverse: {
      kind: "move",
      studentNumber: p.studentNumber,
      toSlotId: p.slotId,
      ...(to === null && p.answers && { answers: p.answers }),
    },
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

function unenrollTeam<P extends BoardPerson>(
  s: BoardState<P>,
  { slotId }: Command<"unenrollTeam">,
): Step<P> {
  if (!hasSlot(s, slotId)) return "SLOT_NOT_FOUND"
  const team = s.people.filter((p) => p.slotId === slotId)
  if (team.length === 0) return "NO_CHANGE"
  const answers = team[0]!.answers
  return {
    people: s.people.map((q) => (q.slotId === slotId ? { ...q, slotId: null } : q)),
    inverse: {
      kind: "enrollTeam",
      slotId,
      studentNumbers: team.map((p) => p.studentNumber),
      ...(answers && { answers }),
    },
  }
}

/** Cofnięcie wypisania zespołu: wraca tylko do pustego slotu, więc odwrotność jest dokładna. */
function enrollTeam<P extends BoardPerson>(s: BoardState<P>, c: Command<"enrollTeam">): Step<P> {
  if (!hasSlot(s, c.slotId)) return "SLOT_NOT_FOUND"
  const team = c.studentNumbers.map((n) => findPerson(s, n))
  if (team.some((p) => !p)) return "PERSON_NOT_FOUND"
  if (team.some((p) => p!.slotId !== null)) return "NO_CHANGE"
  if (teamSize(s, c.slotId) > 0 || team.length > s.maxTeamSize) return "SLOT_FULL"
  const joining = new Set(c.studentNumbers)
  return {
    people: s.people.map((q) =>
      joining.has(q.studentNumber)
        ? { ...q, slotId: c.slotId, ...(c.answers && { answers: c.answers }) }
        : q,
    ),
    inverse: { kind: "unenrollTeam", slotId: c.slotId },
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
    case "unenrollTeam":
      return unenrollTeam(s, c)
    case "enrollTeam":
      return enrollTeam(s, c)
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

/** Co przeciągnięto i na co upuszczono na tablicy. */
export type DragRef =
  | { kind: "person"; studentNumber: string }
  | { kind: "team"; slotId: string }
  | { kind: "slot"; slotId: string }
  | { kind: "pool" }

/** Tłumaczy upuszczenie na polecenie tablicy; `null` = nic do zrobienia. */
export function dropCommand(
  source: DragRef,
  target: DragRef,
  people: BoardPerson[],
): BoardCommand | null {
  const slotOf = (n: string) => people.find((p) => p.studentNumber === n)?.slotId ?? null
  if (source.kind === "person") {
    if (target.kind === "pool")
      return { kind: "move", studentNumber: source.studentNumber, toSlotId: null }
    if (target.kind === "slot") {
      return { kind: "move", studentNumber: source.studentNumber, toSlotId: target.slotId }
    }
    if (target.kind === "person" && target.studentNumber !== source.studentNumber) {
      return { kind: "swapPeople", a: source.studentNumber, b: target.studentNumber }
    }
    return null
  }
  if (source.kind !== "team") return null
  if (target.kind === "pool") return { kind: "unenrollTeam", slotId: source.slotId }
  const to =
    target.kind === "slot"
      ? target.slotId
      : target.kind === "person"
        ? slotOf(target.studentNumber)
        : null
  return to && to !== source.slotId ? { kind: "swapSlots", a: source.slotId, b: to } : null
}

/** Identyfikatory elementów tablicy w dnd-kit: `p:`/`pt:` osoba, `s:` slot, `t:` zespół, `pool`. */
export function parseDragId(id: string | number): DragRef | undefined {
  const [prefix, value] = String(id).split(/:(.*)/)
  if (prefix === "pool") return { kind: "pool" }
  if (!value) return undefined
  if (prefix === "p" || prefix === "pt") return { kind: "person", studentNumber: value }
  if (prefix === "s") return { kind: "slot", slotId: value }
  if (prefix === "t") return { kind: "team", slotId: value }
  return undefined
}
