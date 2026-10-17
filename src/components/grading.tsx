import { MessageSquareIcon, UsersIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GRADES, type BoardCommand, type Grade } from "@/domain/board"
import { fullName } from "@/domain/schedule"
import { formatDayTime } from "@/domain/time"
import { GRADE, GRADING } from "@/messages.pl"
import type { ExamDetail } from "@/server/exam-state.server"

type Person = ExamDetail["people"][number]

const isGraded = (p: Person) => p.grade !== null || p.gradeComment !== null
const failing = (g: Grade | null) => g === "G2" || g === "ABSENT"

const chipTone = (g: Grade | null) =>
  g === null
    ? "border-dashed text-muted-foreground"
    : failing(g)
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-primary/40 bg-primary/10 text-primary"

function lastChange(p: Person) {
  if (!p.gradedAt) return GRADING.notGraded
  return `${p.gradedBy ?? GRADING.deletedAccount}, ${formatDayTime(p.gradedAt)}`
}

/** Znaczek oceny na kafelku osoby; klik otwiera okienko z oceną, komentarzem i „cały zespół”. */
export function GradeChip({
  person,
  team,
  onCommand,
}: {
  person: Person
  team: Person[]
  onCommand: (command: BoardCommand) => boolean
}) {
  const set = (grade: Grade | null, comment = person.gradeComment) =>
    onCommand({ kind: "setGrades", grades: { [person.studentNumber]: { grade, comment } } })
  const name = fullName(person)
  return (
    <Popover>
      <PopoverTrigger
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={GRADING.chipLabel(name)}
        className={`inline-flex h-6 min-w-9 items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs font-bold tabular-nums ${chipTone(person.grade)}`}
      >
        {person.grade ? GRADE[person.grade].short : GRADING.chipEmpty}
        {person.gradeComment && <MessageSquareIcon aria-hidden className="size-3" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold">{name}</span>
          <span className="text-right text-xs text-muted-foreground">{lastChange(person)}</span>
        </div>
        <ToggleGroup
          aria-label={GRADING.picker}
          variant="outline"
          size="sm"
          spacing={0}
          value={person.grade ? [person.grade] : []}
          onValueChange={(v) => set((v[0] as Grade | undefined) ?? null)}
        >
          {GRADES.map((g) => (
            <ToggleGroupItem
              key={g}
              value={g}
              aria-label={GRADE[g].name}
              className={`tabular-nums ${failing(g) ? "data-pressed:bg-destructive/15" : "data-pressed:bg-primary/15"}`}
            >
              {GRADE[g].short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="grid gap-1">
          <Textarea
            // Po zmianie z serwera (także Cofnij) pole pokazuje zapisany komentarz.
            key={person.gradeComment ?? ""}
            aria-label={GRADING.comment}
            placeholder={GRADING.comment}
            defaultValue={person.gradeComment ?? ""}
            maxLength={500}
            onBlur={(e) => {
              if (e.target.value.trim() !== (person.gradeComment ?? "")) {
                set(person.grade, e.target.value)
              }
            }}
            className="min-h-14"
          />
          <p className="text-xs text-muted-foreground">{GRADING.commentHint}</p>
        </div>
        {team.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            disabled={person.grade === null}
            onClick={() =>
              onCommand({
                kind: "setGrades",
                grades: Object.fromEntries(
                  team.map((t) => [
                    t.studentNumber,
                    { grade: person.grade, comment: t.gradeComment },
                  ]),
                ),
              })
            }
          >
            <UsersIcon /> {GRADING.sameForTeam(team.length)}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Licznik nad tablicą: sam komentarz nie jest oceną. */
export function gradedCount(people: Person[]) {
  const enrolled = people.filter((p) => p.slotId !== null)
  return GRADING.counter(enrolled.filter((p) => p.grade !== null).length, enrolled.length)
}

/**
 * Usunięcie zapisu osoby z oceną albo komentarzem czeka na potwierdzenie (tylko w kliencie).
 * `guard` zwraca `false` i otwiera okno; po potwierdzeniu polecenie idzie dalej.
 */
export function useUnenrollGuard(people: Person[], run: (command: BoardCommand) => boolean) {
  const [pending, setPending] = useState<{ who: Person[]; command: BoardCommand } | null>(null)
  const losing = (command: BoardCommand) => {
    if (command.kind === "move" && command.toSlotId === null)
      return people.filter((p) => p.studentNumber === command.studentNumber && p.slotId !== null)
    if (command.kind === "unenrollTeam") return people.filter((p) => p.slotId === command.slotId)
    return []
  }
  const guarded = (command: BoardCommand) => {
    const who = losing(command).filter(isGraded)
    if (who.length === 0) return run(command)
    setPending({ who, command })
    return false
  }
  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent>
        <DialogTitle>{GRADING.confirmTitle}</DialogTitle>
        <DialogDescription>{GRADING.confirmLead}</DialogDescription>
        <ul className="grid gap-1 text-sm">
          {pending?.who.map((p) => (
            <li key={p.studentNumber}>
              {fullName(p)} ({p.studentNumber}): {p.grade ? GRADE[p.grade].name : "—"}
              {p.gradeComment && `, „${p.gradeComment}”`}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>
            {GRADING.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              run(pending!.command)
              setPending(null)
            }}
          >
            {GRADING.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  return { run: guarded, dialog }
}
