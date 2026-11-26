import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useState } from "react"

import { boardPlugins } from "@/components/board-accessibility"
import { BoardSlotRow, UnenrolledPanel } from "@/components/board-parts"
import { useUnenrollGuard } from "@/components/grading"
import { hasManyRosters, rosterNames } from "@/components/roster-choice"
import { CapacitySummary } from "@/components/slot-section"
import { Input } from "@/components/ui/input"
import { useBoardBusy, useBoardCommand } from "@/components/use-board-command"
import { useExamChanges } from "@/components/use-exam-changes"
import { PageTitle } from "@/components/page-title"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dropCommand, parseDragId } from "@/domain/board"
import { examCounts, fullName } from "@/domain/schedule"
import { formatDayShort, warsawDay } from "@/domain/time"
import { GRADING } from "@/messages.pl"
import type { ExamDetail } from "@/server/exam-state.server"
import { examQuery } from "@/server/exams"

export function EnrollmentBoard({ exam }: { exam: ExamDetail }) {
  const [search, setSearch] = useState("")
  const [dragging, setDragging] = useState(false)
  const { run, dialog } = useUnenrollGuard(exam, useBoardCommand(exam))
  // Sygnał w trakcie kolejki nadpisałby stan optymistyczny, w trakcie przeciągania — kafelki pod kursorem.
  useExamChanges(exam.id, examQuery(exam.id).queryKey, {
    defer: useBoardBusy(exam.id) || dragging,
  })
  const rosterNameOf = hasManyRosters(exam.rosters) ? rosterNames(exam.rosters) : null
  const teams = Map.groupBy(exam.people, (p) => p.slotId)
  const q = search.trim().toLowerCase()
  const highlight = (p: ExamDetail["people"][number]) =>
    q !== "" && (p.studentNumber.includes(q) || fullName(p).toLowerCase().includes(q))

  const onDragEnd = ({ operation, canceled }: DragEndEvent) => {
    setDragging(false)
    const source = operation.source ? parseDragId(operation.source.id) : undefined
    const target = operation.target ? parseDragId(operation.target.id) : undefined
    if (canceled || !source || !target) return
    const command = dropCommand(source, target, exam.people)
    if (command) run(command)
  }

  const { enrolled, graded, freeSlots } = examCounts(exam, exam.now)

  return (
    <DragDropProvider
      plugins={boardPlugins}
      onDragStart={() => setDragging(true)}
      onDragEnd={onDragEnd}
    >
      <div className="grid gap-4">
        <header className="grid gap-2">
          <PageTitle>{exam.name} — tablica zapisów</PageTitle>
          <p className="tabular-nums text-muted-foreground">
            zapisani {enrolled} / {exam.people.length} · wolne sloty {freeSlots} · miejsca{" "}
            {exam.slots.length * exam.maxTeamSize} · {GRADING.counter(graded, enrolled)}
          </p>
          <CapacitySummary exam={exam} />
          <Input
            aria-label="Znajdź indeks albo nazwisko"
            placeholder="Znajdź indeks albo nazwisko"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm bg-card"
          />
        </header>
        <div className="grid items-start gap-4 md:grid-cols-[16rem_1fr]">
          <UnenrolledPanel exam={exam} highlight={highlight} onCommand={run} />
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Dzień</TableHead>
                  <TableHead>Godzina</TableHead>
                  {rosterNameOf && <TableHead>Lista</TableHead>}
                  <TableHead>Zespół</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.slots.map((slot, i) => {
                  const day = warsawDay(slot.startsAt)
                  const prev = exam.slots[i - 1]
                  const firstOfDay = !prev || warsawDay(prev.startsAt) !== day
                  const team = teams.get(slot.id) ?? []
                  return (
                    <BoardSlotRow
                      key={slot.id}
                      slot={slot}
                      team={team}
                      people={exam.people}
                      dayLabel={firstOfDay ? formatDayShort(slot.startsAt) : null}
                      rosterNames={rosterNameOf}
                      maxTeamSize={exam.maxTeamSize}
                      fields={exam.fields}
                      highlight={highlight}
                      onCommand={run}
                    />
                  )
                })}
              </TableBody>
            </Table>
            {exam.slots.length === 0 && (
              <p className="p-4 text-muted-foreground">Zaliczenie nie ma jeszcze slotów.</p>
            )}
          </div>
        </div>
      </div>
      {dialog}
    </DragDropProvider>
  )
}
