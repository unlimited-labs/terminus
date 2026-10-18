import type { Answers } from "./fields.ts"

export type BoardPerson = {
  studentNumber: string
  slotId: string | null
  firstName: string
  lastName: string
  answers?: Answers
  grade?: Grade | null
  gradeComment?: string | null
}

export const GRADES = ["G2", "G3", "G3_5", "G4", "G4_5", "G5", "ABSENT"] as const
export type Grade = (typeof GRADES)[number]
export type GradeEntry = { grade: Grade | null; comment: string | null }

export type BoardState<P extends BoardPerson = BoardPerson> = {
  maxTeamSize: number
  slots: { id: string }[]
  people: P[]
}

/** `toSlotId: null` to panel "Niezapisani"; `answers` i `grade(s)` niesie Cofnij wypisania. */
export type BoardCommand =
  | {
      kind: "move"
      studentNumber: string
      toSlotId: string | null
      answers?: Answers
      grade?: GradeEntry
    }
  | { kind: "swapPeople"; a: string; b: string }
  | { kind: "swapSlots"; a: string; b: string }
  | { kind: "rename"; studentNumber: string; firstName: string; lastName: string }
  | { kind: "unenrollTeam"; slotId: string }
  | {
      kind: "enrollTeam"
      slotId: string
      studentNumbers: string[]
      answers?: Answers
      grades?: Record<string, GradeEntry>
    }
  | { kind: "setAnswers"; slotId: string; answers: Answers }
  | { kind: "setGrades"; grades: Record<string, GradeEntry> }

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

const teamOf = <P extends BoardPerson>(s: BoardState<P>, slotId: string) =>
  s.people.filter((p) => p.slotId === slotId)
const teamSize = (s: BoardState, slotId: string) => teamOf(s, slotId).length
const hasSlot = (s: BoardState, id: string) => s.slots.some((slot) => slot.id === id)
const findPerson = <P extends BoardPerson>(s: BoardState<P>, n: string) =>
  s.people.find((p) => p.studentNumber === n)

const gradeOf = (p: BoardPerson): GradeEntry => ({
  grade: p.grade ?? null,
  comment: p.gradeComment ?? null,
})
/** Ma ocenę albo sam komentarz: jest co stracić przy usunięciu zapisu. */
export const isGraded = (p: BoardPerson) => p.grade != null || p.gradeComment != null
const withGrade = (g: GradeEntry) => ({ grade: g.grade, gradeComment: g.comment })
type Graded = Pick<BoardPerson, "grade" | "gradeComment">
export const sameGrade = (a: Graded, b: Graded) =>
  (a.grade ?? null) === (b.grade ?? null) && (a.gradeComment ?? null) === (b.gradeComment ?? null)
const NO_GRADE = withGrade({ grade: null, comment: null })

function move<P extends BoardPerson>(s: BoardState<P>, c: Command<"move">): Step<P> {
  const p = findPerson(s, c.studentNumber)
  if (!p) return "PERSON_NOT_FOUND"
  const to = c.toSlotId
  if (to !== null && !hasSlot(s, to)) return "SLOT_NOT_FOUND"
  if (p.slotId === to) return "NO_CHANGE"
  if (to !== null && teamSize(s, to) >= s.maxTeamSize) return "SLOT_FULL"
  return {
    people: s.people.map((q) =>
      q === p
        ? {
            ...q,
            slotId: to,
            ...(c.answers && { answers: c.answers }),
            ...(to === null ? NO_GRADE : c.grade && withGrade(c.grade)),
          }
        : q,
    ),
    inverse: {
      kind: "move",
      studentNumber: p.studentNumber,
      toSlotId: p.slotId,
      ...(to === null && p.answers && { answers: p.answers }),
      ...(to === null && isGraded(p) && { grade: gradeOf(p) }),
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
  const team = teamOf(s, slotId)
  if (team.length === 0) return "NO_CHANGE"
  const answers = team[0]!.answers
  const graded = team.filter(isGraded)
  return {
    people: s.people.map((q) => (q.slotId === slotId ? { ...q, slotId: null, ...NO_GRADE } : q)),
    inverse: {
      kind: "enrollTeam",
      slotId,
      studentNumbers: team.map((p) => p.studentNumber),
      ...(answers && { answers }),
      ...(graded.length > 0 && {
        grades: Object.fromEntries(graded.map((p) => [p.studentNumber, gradeOf(p)])),
      }),
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
        ? {
            ...q,
            slotId: c.slotId,
            ...(c.answers && { answers: c.answers }),
            ...withGrade(c.grades?.[q.studentNumber] ?? gradeOf(q)),
          }
        : q,
    ),
    inverse: { kind: "unenrollTeam", slotId: c.slotId },
  }
}

const sameAnswers = (a: Answers = {}, b: Answers = {}) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k])

function setAnswers<P extends BoardPerson>(
  s: BoardState<P>,
  { slotId, answers }: Command<"setAnswers">,
): Step<P> {
  if (!hasSlot(s, slotId)) return "SLOT_NOT_FOUND"
  const team = teamOf(s, slotId)
  if (team.length === 0) return "NOT_ENROLLED"
  const previous = team[0]!.answers ?? {}
  if (sameAnswers(previous, answers)) return "NO_CHANGE"
  return {
    people: s.people.map((q) => (q.slotId === slotId ? { ...q, answers } : q)),
    inverse: { kind: "setAnswers", slotId, answers: previous },
  }
}

function setGrades<P extends BoardPerson>(s: BoardState<P>, c: Command<"setGrades">): Step<P> {
  const next = new Map(
    Object.entries(c.grades).map(([n, g]) => [n, { ...g, comment: g.comment?.trim() || null }]),
  )
  const people = [...next.keys()].flatMap((n) => findPerson(s, n) ?? [])
  if (people.length !== next.size) return "PERSON_NOT_FOUND"
  if (people.some((p) => p.slotId === null)) return "NOT_ENROLLED"
  const changed = people.some((p) => !sameGrade(p, withGrade(next.get(p.studentNumber)!)))
  if (!changed) return "NO_CHANGE"
  return {
    people: s.people.map((q) => {
      const g = next.get(q.studentNumber)
      return g ? { ...q, ...withGrade(g) } : q
    }),
    inverse: {
      kind: "setGrades",
      grades: Object.fromEntries(people.map((p) => [p.studentNumber, gradeOf(p)])),
    },
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
    case "setAnswers":
      return setAnswers(s, c)
    case "setGrades":
      return setGrades(s, c)
  }
}

function inheritTeamAnswers<P extends BoardPerson>(before: P[], after: P[]): P[] {
  const slotBefore = new Map(before.map((p) => [p.studentNumber, p.slotId]))
  const moved = (p: P) => p.slotId !== null && slotBefore.get(p.studentNumber) !== p.slotId
  const teamAnswers = new Map(
    after.filter((p) => p.slotId !== null && !moved(p)).map((p) => [p.slotId, p.answers]),
  )
  return after.map((p) => {
    const answers = moved(p) ? teamAnswers.get(p.slotId) : undefined
    return answers ? { ...p, answers } : p
  })
}

export function applyCommand<P extends BoardPerson, S extends BoardState<P>>(
  state: S,
  command: BoardCommand,
): BoardResult<S> {
  const result = step(state, command)
  if (typeof result === "string") return { ok: false, code: result }
  const people = inheritTeamAnswers(state.people, result.people)
  return { ok: true, state: { ...state, people }, inverse: result.inverse }
}

/** Pary `[przed, po]` osób zmienionych poleceniem; polecenia nie dodają ani nie usuwają osób. */
export function changedPeople<P extends BoardPerson>(
  before: BoardState<P>,
  after: BoardState<P>,
): [P, P][] {
  const old = new Map(before.people.map((p) => [p.studentNumber, p]))
  return after.people.flatMap((p): [P, P][] => {
    const o = old.get(p.studentNumber)
    const changed =
      o &&
      (o.slotId !== p.slotId ||
        o.firstName !== p.firstName ||
        o.lastName !== p.lastName ||
        o.answers !== p.answers ||
        !sameGrade(o, p))
    return changed ? [[o, p]] : []
  })
}

/**
 * Polecenia wysłane, a jeszcze bez odpowiedzi serwera, nad ostatnim znanym stanem serwera;
 * `null` = nic nie czeka. Polecenie jest rozpoznawane po tożsamości obiektu.
 */
export type BoardQueue<S> = { server: S; pending: BoardCommand[] } | null

const replay = <S extends BoardState>(state: S, commands: BoardCommand[]) =>
  commands.reduce((s, c) => {
    const next = applyCommand(s, c)
    return next.ok ? next.state : s
  }, state)

export function enqueue<S extends BoardState>(
  queue: BoardQueue<S>,
  current: S,
  command: BoardCommand,
): { ok: true; queue: NonNullable<BoardQueue<S>>; shown: S } | { ok: false; code: BoardErrorCode } {
  const local = applyCommand(current, command)
  if (!local.ok) return local
  return {
    ok: true,
    queue: { server: queue?.server ?? current, pending: [...(queue?.pending ?? []), command] },
    shown: local.state,
  }
}

/** Serwer odpowiedział na `command`: `latest` po sukcesie, bez niego przy porażce. */
export function settle<S extends BoardState>(
  queue: NonNullable<BoardQueue<S>>,
  command: BoardCommand,
  latest?: S,
): { queue: BoardQueue<S>; shown: S } {
  const server = latest ?? queue.server
  const pending = queue.pending.filter((c) => c !== command)
  return { queue: pending.length > 0 ? { server, pending } : null, shown: replay(server, pending) }
}

/** Co przeciągnięto i na co upuszczono na tablicy. */
export type DragRef =
  | { kind: "person"; studentNumber: string }
  | { kind: "team"; slotId: string }
  | { kind: "slot"; slotId: string }
  | { kind: "pool" }

/** Slot, na który upuszczono zespół: sam slot albo slot osoby; `null` = poza slotem. */
function targetSlotId(target: DragRef, people: BoardPerson[]): string | null {
  if (target.kind === "slot") return target.slotId
  if (target.kind === "person")
    return people.find((p) => p.studentNumber === target.studentNumber)?.slotId ?? null
  return null
}

/** Tłumaczy upuszczenie na polecenie tablicy; `null` = nic do zrobienia. */
export function dropCommand(
  source: DragRef,
  target: DragRef,
  people: BoardPerson[],
): BoardCommand | null {
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
  const to = targetSlotId(target, people)
  return to && to !== source.slotId ? { kind: "swapSlots", a: source.slotId, b: to } : null
}

/**
 * Identyfikatory elementów tablicy w dnd-kit: `p:` osoba przeciągana, `pt:` osoba jako cel
 * upuszczenia (`role: "target"`), `s:` slot, `t:` zespół, `pool`.
 */
export function dragId(ref: DragRef, role?: "target"): string {
  switch (ref.kind) {
    case "person":
      return `${role === "target" ? "pt" : "p"}:${ref.studentNumber}`
    case "slot":
      return `s:${ref.slotId}`
    case "team":
      return `t:${ref.slotId}`
    case "pool":
      return "pool"
  }
}

export function parseDragId(id: string | number): DragRef | undefined {
  const [prefix, value] = String(id).split(/:(.*)/)
  if (prefix === "pool") return { kind: "pool" }
  if (!value) return undefined
  if (prefix === "p" || prefix === "pt") return { kind: "person", studentNumber: value }
  if (prefix === "s") return { kind: "slot", slotId: value }
  if (prefix === "t") return { kind: "team", slotId: value }
  return undefined
}
