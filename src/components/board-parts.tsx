import { useDragOperation, useDraggable, useDroppable } from "@dnd-kit/react"
import { GripVerticalIcon, PencilIcon } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { parseDragId, type BoardCommand } from "@/domain/board"
import { formatDayShort, warsawTime } from "@/domain/time"
import type { ExamDetail } from "@/server/exam-state.server"

type Person = ExamDetail["people"][number]
type Slot = ExamDetail["slots"][number]

const personLabel = (p: Person) =>
  p.firstName ? `${p.firstName} ${p.lastName} (${p.studentNumber})` : p.studentNumber

function PersonTile({
  person,
  highlighted,
  foreignRoster,
  onCommand,
}: {
  person: Person
  highlighted: boolean
  foreignRoster?: string
  onCommand: (command: BoardCommand) => void
}) {
  const [editing, setEditing] = useState(false)
  const refocusPencil = useRef(false)
  const drag = useDraggable({
    id: `p:${person.studentNumber}`,
    type: "person",
    data: { label: personLabel(person) },
    disabled: editing,
  })
  const drop = useDroppable({
    id: `pt:${person.studentNumber}`,
    accept: "person",
    data: { label: personLabel(person) },
    collisionPriority: 3,
    disabled: person.slotId === null,
  })

  if (editing) {
    return (
      <RenameForm
        person={person}
        onDone={() => {
          refocusPencil.current = true
          setEditing(false)
        }}
        onSave={(firstName, lastName) =>
          onCommand({ kind: "rename", studentNumber: person.studentNumber, firstName, lastName })
        }
      />
    )
  }
  const unenrolled = person.slotId === null
  return (
    <div
      ref={(el) => {
        drag.ref(el)
        drop.ref(el)
      }}
      className={`flex shrink-0 cursor-grab touch-none items-center gap-2 rounded-lg border bg-card px-2 py-1 text-sm ${
        drop.isDropTarget ? "ring-2 ring-primary" : ""
      } ${drag.isDragging ? "opacity-50" : ""} ${highlighted ? "bg-yellow-100 ring-2 ring-yellow-400" : ""}`}
    >
      {unenrolled ? (
        <span className="font-semibold tabular-nums">{person.studentNumber}</span>
      ) : (
        <span className="grid leading-tight">
          <span className="font-semibold whitespace-nowrap">
            {person.firstName} {person.lastName}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {person.studentNumber}
            {foreignRoster && ` · ${foreignRoster}`}
          </span>
        </span>
      )}
      {!unenrolled && (
        <Button
          ref={(el: HTMLButtonElement | null) => {
            if (el && refocusPencil.current) {
              refocusPencil.current = false
              el.focus()
            }
          }}
          variant="ghost"
          size="icon-xs"
          aria-label={`Zmień imię i nazwisko: ${person.firstName} ${person.lastName}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setEditing(true)}
          className="text-muted-foreground"
        >
          <PencilIcon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function RenameForm({
  person,
  onSave,
  onDone,
}: {
  person: Person
  onSave: (firstName: string, lastName: string) => void
  onDone: () => void
}) {
  const [firstName, setFirstName] = useState(person.firstName)
  const [lastName, setLastName] = useState(person.lastName)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onDone()
  }
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    onSave(firstName.trim(), lastName.trim())
    onDone()
  }
  return (
    <form onSubmit={onSubmit} className="flex shrink-0 gap-1 rounded-lg border bg-card p-1">
      <Input
        aria-label="Imię"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-7 w-24"
        autoFocus
      />
      <Input
        aria-label="Nazwisko"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-7 w-28"
      />
      <Button type="submit" size="sm" className="h-7">
        Zapisz
      </Button>
    </form>
  )
}

function useSlotDnd(slot: Slot, team: Person[], maxTeamSize: number, label: string) {
  const drop = useDroppable({
    id: `s:${slot.id}`,
    accept: ["person", "team"],
    data: { label },
    collisionPriority: 1,
  })
  const { handleRef: attachHandle, ...drag } = useDraggable({
    id: `t:${slot.id}`,
    type: "team",
    data: { label: `zespół, ${label}` },
    disabled: team.length === 0,
  })
  const { source } = useDragOperation()
  const incoming = source ? parseDragId(source.id) : undefined
  const rejects =
    drop.isDropTarget &&
    incoming?.kind === "person" &&
    team.length >= maxTeamSize &&
    !team.some((p) => p.studentNumber === incoming.studentNumber)
  const tone = rejects
    ? "bg-destructive/15 hover:bg-destructive/15"
    : drop.isDropTarget
      ? "bg-primary/10 hover:bg-primary/10"
      : "hover:bg-transparent"
  return {
    attach: (el: HTMLElement | null) => {
      drop.ref(el)
      drag.ref(el)
    },
    attachHandle,
    tone: `${tone} ${drag.isDragging ? "opacity-50" : ""}`,
  }
}

function TeamCell({
  slot,
  team,
  rosterOf,
  highlight,
  onCommand,
}: {
  slot: Slot
  team: Person[]
  rosterOf: (rosterId: string) => string | undefined
  highlight: (p: Person) => boolean
  onCommand: (command: BoardCommand) => void
}) {
  if (team.length === 0) return <span className="text-free">wolny</span>
  return (
    <div className="flex gap-2 overflow-x-auto">
      {team.map((p) => (
        <PersonTile
          key={p.studentNumber}
          person={p}
          highlighted={highlight(p)}
          foreignRoster={p.rosterId === slot.rosterId ? undefined : rosterOf(p.rosterId)}
          onCommand={onCommand}
        />
      ))}
    </div>
  )
}

export function BoardSlotRow({
  slot,
  team,
  dayLabel,
  rosterName,
  maxTeamSize,
  rosterOf,
  highlight,
  onCommand,
  extra,
}: {
  slot: Slot
  team: Person[]
  dayLabel: string | null
  rosterName?: string
  maxTeamSize: number
  rosterOf: (rosterId: string) => string | undefined
  highlight: (p: Person) => boolean
  onCommand: (command: BoardCommand) => void
  extra?: React.ReactNode
}) {
  const label = `slot ${formatDayShort(slot.startsAt)} ${warsawTime(slot.startsAt)}`
  const { attach, attachHandle, tone } = useSlotDnd(slot, team, maxTeamSize, label)
  return (
    <TableRow
      ref={attach}
      className={`border-b-0 ${dayLabel ? "border-t-2! border-t-foreground/25" : "border-t!"} ${tone}`}
    >
      <TableCell className="px-2 py-1.5 align-top font-bold capitalize">{dayLabel}</TableCell>
      <TableCell className="px-2 py-1.5 align-top">
        <span className="flex items-center gap-1">
          <Button
            ref={attachHandle}
            variant="ghost"
            size="icon-xs"
            disabled={team.length === 0}
            aria-label={`Przenieś cały zespół: ${label}`}
            className="cursor-grab touch-none text-muted-foreground disabled:invisible"
          >
            <GripVerticalIcon className="size-4" />
          </Button>
          <span className="font-semibold tabular-nums">
            {warsawTime(slot.startsAt)}–{warsawTime(slot.endsAt)}
          </span>
        </span>
      </TableCell>
      {rosterName !== undefined && (
        <TableCell className="px-2 py-1.5 align-top">{rosterName}</TableCell>
      )}
      <TableCell className="px-2 py-1.5 whitespace-normal">
        <TeamCell
          slot={slot}
          team={team}
          rosterOf={rosterOf}
          highlight={highlight}
          onCommand={onCommand}
        />
        {extra}
      </TableCell>
    </TableRow>
  )
}

export function UnenrolledPanel({
  exam,
  highlight,
  onCommand,
}: {
  exam: ExamDetail
  highlight: (p: Person) => boolean
  onCommand: (command: BoardCommand) => void
}) {
  const [filter, setFilter] = useState("")
  const { ref: attachPool, isDropTarget } = useDroppable({
    id: "pool",
    accept: "person",
    data: { label: "Niezapisani" },
    collisionPriority: 1,
  })
  const unenrolled = exam.people.filter((p) => p.slotId === null)
  const shown = unenrolled.filter((p) => p.studentNumber.includes(filter.trim()))
  const groups = exam.rosters.length > 1 ? exam.rosters : [{ id: null, name: "" }]

  return (
    <aside
      ref={attachPool}
      aria-label="Niezapisani"
      className={`sticky top-4 grid max-h-[calc(100svh-2rem)] content-start gap-3 overflow-y-auto rounded-xl border bg-card p-3 ${
        isDropTarget ? "ring-2 ring-primary" : ""
      }`}
    >
      <h2 className="flex justify-between font-extrabold">
        Niezapisani <span className="tabular-nums text-muted-foreground">{unenrolled.length}</span>
      </h2>
      <p className="text-xs text-muted-foreground">
        Upuść tu osobę, żeby usunąć jej zapis. Przeciągnij stąd na slot, żeby zapisać ręcznie.
      </p>
      <Input
        aria-label="Szukaj indeksu"
        placeholder="Szukaj indeksu"
        inputMode="numeric"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {groups.map((g) => {
        const people = shown.filter((p) => g.id === null || p.rosterId === g.id)
        return (
          <section key={g.id ?? "all"} className="grid gap-2">
            {g.id && <h3 className="text-sm font-bold">{g.name}</h3>}
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <PersonTile
                  key={p.studentNumber}
                  person={p}
                  highlighted={highlight(p)}
                  onCommand={onCommand}
                />
              ))}
            </div>
          </section>
        )
      })}
    </aside>
  )
}
