import { useDragOperation, useDraggable, useDroppable } from "@dnd-kit/react"
import { cn } from "cn"
import { GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { GradeChip } from "@/components/grading"
import { hasManyRosters } from "@/components/roster-choice"
import { SlotAnswers } from "@/components/slot-answers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { dragId, parseDragId, type BoardCommand } from "@/domain/board"
import type { ExamField } from "@/domain/fields"
import { fullName, personLabel } from "@/domain/schedule"
import { formatDayShort, formatSlotTime, warsawTime } from "@/domain/time"
import type { ExamDetail } from "@/server/exam-state.server"

type Person = ExamDetail["people"][number]
type Slot = ExamDetail["slots"][number]

type ElementRef = (el: HTMLElement | null) => void

/** Stały ref z dwóch: nowa funkcja co render odpina i przypina element w dnd-kit. */
function useJoinedRef(a: ElementRef, b: ElementRef) {
  return useCallback(
    (el: HTMLElement | null) => {
      a(el)
      b(el)
    },
    [a, b],
  )
}

/** Przycisk ikony na kafelku: nie zaczyna przeciągania kafelka. */
const TileAction = (props: React.ComponentProps<typeof Button>) => (
  <Button variant="ghost" size="icon-xs" onPointerDown={(e) => e.stopPropagation()} {...props} />
)

function PersonTile({
  person,
  team,
  highlighted,
  foreignRoster,
  onCommand,
}: {
  person: Person
  /** Zespół osoby w slocie: kafelek na całą szerokość ze znaczkiem oceny. */
  team?: Person[]
  highlighted: boolean
  foreignRoster?: string
  onCommand: (command: BoardCommand) => boolean
}) {
  const [editing, setEditing] = useState(false)
  const refocusPencil = useRef(false)
  const unenrolled = person.slotId === null
  const ref = { kind: "person", studentNumber: person.studentNumber } as const
  const drag = useDraggable({
    id: dragId(ref),
    type: "person",
    data: { label: personLabel(person) },
    disabled: editing,
  })
  const drop = useDroppable({
    id: dragId(ref, "target"),
    accept: "person",
    data: { label: personLabel(person) },
    collisionPriority: 3,
    disabled: unenrolled,
  })
  const attach = useJoinedRef(drag.ref, drop.ref)

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
  return (
    <div
      ref={attach}
      className={cn(
        "flex shrink-0 cursor-grab touch-none items-center gap-2 rounded-lg border bg-card px-2 py-1 text-sm",
        team !== undefined && "w-full",
        drop.isDropTarget && "ring-2 ring-primary",
        drag.isDragging && "opacity-50",
        highlighted && "bg-yellow-100 ring-2 ring-yellow-400",
      )}
    >
      {unenrolled ? (
        <span className="font-semibold tabular-nums">{person.studentNumber}</span>
      ) : (
        <span className="grid flex-1 leading-tight">
          <span className="font-semibold whitespace-nowrap">{fullName(person)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {person.studentNumber}
            {foreignRoster && ` · ${foreignRoster}`}
          </span>
        </span>
      )}
      {!unenrolled && (
        <>
          {team && <GradeChip person={person} team={team} onCommand={onCommand} />}
          <TileAction
            ref={(el: HTMLButtonElement | null) => {
              if (el && refocusPencil.current) {
                refocusPencil.current = false
                el.focus()
              }
            }}
            aria-label={`Zmień imię i nazwisko: ${fullName(person)}`}
            onClick={() => setEditing(true)}
            className="text-muted-foreground"
          >
            <PencilIcon className="size-3.5" />
          </TileAction>
          <TileAction
            aria-label={`Usuń zapis: ${fullName(person)}`}
            onClick={() =>
              onCommand({ kind: "move", studentNumber: person.studentNumber, toSlotId: null })
            }
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
          </TileAction>
        </>
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
  /** `false` = odrzucone od razu; formularz zostaje otwarty. */
  onSave: (firstName: string, lastName: string) => boolean
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
    if (onSave(firstName, lastName)) onDone()
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
    id: dragId({ kind: "slot", slotId: slot.id }),
    accept: ["person", "team"],
    data: { label },
    collisionPriority: 1,
  })
  const { handleRef: attachHandle, ...drag } = useDraggable({
    id: dragId({ kind: "team", slotId: slot.id }),
    type: "team",
    data: { label: `zespół, ${label}` },
    disabled: team.length === 0,
  })
  // Odczyt `source` dopiero przy celu upuszczenia: tylko wtedy wiersz subskrybuje przeciąganie.
  const operation = useDragOperation()
  const dropTone = () => {
    if (!drop.isDropTarget) return "hover:bg-transparent"
    const { source } = operation
    const incoming = source ? parseDragId(source.id) : undefined
    const rejects =
      incoming?.kind === "person" &&
      team.length >= maxTeamSize &&
      !team.some((p) => p.studentNumber === incoming.studentNumber)
    return rejects
      ? "bg-destructive/15 hover:bg-destructive/15"
      : "bg-primary/10 hover:bg-primary/10"
  }
  return {
    attach: useJoinedRef(drop.ref, drag.ref),
    attachHandle,
    tone: `${dropTone()} ${drag.isDragging ? "opacity-50" : ""}`,
  }
}

function TeamCell({
  slot,
  team,
  rosterNames,
  highlight,
  onCommand,
}: {
  slot: Slot
  team: Person[]
  rosterNames: Map<string, string> | null
  highlight: (p: Person) => boolean
  onCommand: (command: BoardCommand) => boolean
}) {
  if (team.length === 0) return <span className="text-free">wolny</span>
  return (
    <div className="grid gap-1">
      {team.map((p) => (
        <PersonTile
          key={p.studentNumber}
          person={p}
          team={team}
          highlighted={highlight(p)}
          foreignRoster={p.rosterId === slot.rosterId ? undefined : rosterNames?.get(p.rosterId)}
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
  rosterNames,
  maxTeamSize,
  fields,
  highlight,
  onCommand,
}: {
  slot: Slot
  team: Person[]
  dayLabel: string | null
  /** `null` = jedna lista, bez kolumny „Lista”. */
  rosterNames: Map<string, string> | null
  maxTeamSize: number
  fields: ExamField[]
  highlight: (p: Person) => boolean
  onCommand: (command: BoardCommand) => boolean
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
          <span className="font-semibold tabular-nums">{formatSlotTime(slot)}</span>
          <TileAction
            disabled={team.length === 0}
            aria-label={`Usuń zapis całego zespołu: ${label}`}
            onClick={() => onCommand({ kind: "unenrollTeam", slotId: slot.id })}
            className="text-muted-foreground hover:text-destructive disabled:invisible"
          >
            <Trash2Icon className="size-4" />
          </TileAction>
        </span>
      </TableCell>
      {rosterNames && (
        <TableCell className="px-2 py-1.5 align-top">{rosterNames.get(slot.rosterId)}</TableCell>
      )}
      <TableCell className="px-2 py-1.5 whitespace-normal">
        <TeamCell
          slot={slot}
          team={team}
          rosterNames={rosterNames}
          highlight={highlight}
          onCommand={onCommand}
        />
        {fields.length > 0 && team[0] && (
          <SlotAnswers
            fields={fields}
            answers={team[0].answers}
            onSave={(answers) => onCommand({ kind: "setAnswers", slotId: slot.id, answers })}
          />
        )}
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
  onCommand: (command: BoardCommand) => boolean
}) {
  const [filter, setFilter] = useState("")
  const { ref: attachPool, isDropTarget } = useDroppable({
    id: dragId({ kind: "pool" }),
    accept: ["person", "team"],
    data: { label: "Niezapisani" },
    collisionPriority: 1,
  })
  const unenrolled = exam.people.filter((p) => p.slotId === null)
  const shown = unenrolled.filter((p) => p.studentNumber.includes(filter.trim()))
  const many = hasManyRosters(exam.rosters)

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
        Upuść tu osobę albo zespół (albo kliknij kosz), żeby usunąć zapis. Przeciągnij stąd na slot,
        żeby zapisać ręcznie.
      </p>
      <Input
        aria-label="Szukaj indeksu"
        placeholder="Szukaj indeksu"
        inputMode="numeric"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {exam.rosters.map((g) => {
        const people = shown.filter((p) => p.rosterId === g.id)
        return (
          <section key={g.id} className="grid gap-2">
            {many && <h3 className="text-sm font-bold">{g.name}</h3>}
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
