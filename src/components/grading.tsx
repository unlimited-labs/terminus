import { MessageSquareIcon, UsersIcon } from "lucide-react"
import { useState } from "react"

import { ConfirmDialog } from "@/components/confirm-button"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  applyCommand,
  changedPeople,
  GRADES,
  isGraded,
  type BoardCommand,
  type Grade,
} from "@/domain/board"
import { GRADE_COMMENT_MAX } from "@/domain/limits"
import { fullName } from "@/domain/schedule"
import { formatDayTime } from "@/domain/time"
import { GRADE, GRADING } from "@/messages.pl"
import type { ExamDetail } from "@/server/exam-state.server"

type Person = ExamDetail["people"][number]

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
  const [comment, setComment] = useState("")
  // Szkic komentarza idzie też z oceną: klik oceny nie zależy od kolejności blur/klik.
  const set = (grade: Grade | null) =>
    onCommand({ kind: "setGrades", grades: { [person.studentNumber]: { grade, comment } } })
  // Zapis przy wyjściu z pola i przy zamknięciu okienka (Escape nie zawsze wywołuje blur).
  const saveComment = () => {
    if (comment.trim() !== (person.gradeComment ?? "")) set(person.grade)
  }
  const name = fullName(person)
  return (
    <Popover
      onOpenChange={(open) => (open ? setComment(person.gradeComment ?? "") : saveComment())}
    >
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
          onValueChange={(v) => set(GRADES.find((g) => g === v[0]) ?? null)}
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
            aria-label={GRADING.comment}
            placeholder={GRADING.comment}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={GRADE_COMMENT_MAX}
            onBlur={saveComment}
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
export function GradedCount({ people }: { people: Person[] }) {
  const enrolled = people.filter((p) => p.slotId !== null)
  return <>{GRADING.counter(enrolled.filter((p) => p.grade !== null).length, enrolled.length)}</>
}

/**
 * Usunięcie zapisu osoby z oceną albo komentarzem czeka na potwierdzenie (tylko w kliencie).
 * `guard` zwraca `false` i otwiera okno; po potwierdzeniu polecenie idzie dalej.
 */
export function useUnenrollGuard(exam: ExamDetail, run: (command: BoardCommand) => boolean) {
  const [pending, setPending] = useState<{ who: Person[]; command: BoardCommand } | null>(null)
  const guarded = (command: BoardCommand) => {
    const applied = applyCommand(exam, command)
    const who = applied.ok
      ? changedPeople(exam, applied.state).flatMap(([prev, next]) =>
          prev.slotId !== null && next.slotId === null && isGraded(prev) ? [prev] : [],
        )
      : []
    if (who.length === 0) return run(command)
    setPending({ who, command })
    return false
  }
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={GRADING.confirmTitle}
      description={GRADING.confirmLead}
      body={
        <ul className="grid gap-1 text-sm">
          {pending?.who.map((p) => (
            <li key={p.studentNumber}>
              {fullName(p)} ({p.studentNumber}): {p.grade ? GRADE[p.grade].name : GRADING.noGrade}
              {p.gradeComment && `, „${p.gradeComment}”`}
            </li>
          ))}
        </ul>
      }
      confirmLabel={GRADING.confirm}
      onConfirm={() => {
        run(pending!.command)
      }}
    />
  )
  return { run: guarded, dialog }
}
