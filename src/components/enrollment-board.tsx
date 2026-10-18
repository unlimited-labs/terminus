import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useState } from "react"

import { boardPlugins } from "@/components/board-accessibility"
import { BoardSlotRow, UnenrolledPanel } from "@/components/board-parts"
import { GradedCount, useUnenrollGuard } from "@/components/grading"
import { hasManyRosters, rosterNames } from "@/components/roster-choice"
import { CapacitySummary } from "@/components/slot-section"
import { Input } from "@/components/ui/input"
import { useBoardCommand } from "@/components/use-board-command"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dropCommand, parseDragId } from "@/domain/board"
import { examCounts, fullName } from "@/domain/schedule"
import { formatDayShort, warsawDay } from "@/domain/time"
import type { ExamDetail } from "@/server/exam-state.server"

export function EnrollmentBoard({ exam }: { exam: ExamDetail }) {
  const [search, setSearch] = useState("")
  const { run, dialog } = useUnenrollGuard(exam, useBoardCommand(exam))
  const multi = hasManyRosters(exam.rosters)
  const rosterName = rosterNames(exam.rosters)
  const q = search.trim().toLowerCase()
  const highlight = (p: ExamDetail["people"][number]) =>
    q !== "" && (p.studentNumber.includes(q) || fullName(p).toLowerCase().includes(q))

  const onDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const source = operation.source ? parseDragId(operation.source.id) : undefined
    const target = operation.target ? parseDragId(operation.target.id) : undefined
    if (canceled || !source || !target) return
    const command = dropCommand(source, target, exam.people)
    if (command) run(command)
  }

  const { enrolled, freeSlots } = examCounts(exam, exam.now)

  return (
    <DragDropProvider plugins={boardPlugins} onDragEnd={onDragEnd}>
      <div className="grid gap-4">
        <header className="grid gap-2">
          <h1 className="text-2xl font-extrabold">{exam.name} — tablica zapisów</h1>
          <p className="tabular-nums text-muted-foreground">
            zapisani {enrolled} / {exam.people.length} · wolne sloty {freeSlots} · miejsca{" "}
            {exam.slots.length * exam.maxTeamSize} · <GradedCount people={exam.people} />
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
                  {multi && <TableHead>Lista</TableHead>}
                  <TableHead>Zespół</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.slots.map((slot, i) => {
                  const day = warsawDay(slot.startsAt)
                  const prev = exam.slots[i - 1]
                  const firstOfDay = !prev || warsawDay(prev.startsAt) !== day
                  const team = exam.people.filter((p) => p.slotId === slot.id)
                  return (
                    <BoardSlotRow
                      key={slot.id}
                      slot={slot}
                      team={team}
                      dayLabel={firstOfDay ? formatDayShort(slot.startsAt) : null}
                      rosterName={multi ? rosterName.get(slot.rosterId) : undefined}
                      maxTeamSize={exam.maxTeamSize}
                      fields={exam.fields}
                      rosterOf={(id) => rosterName.get(id)}
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
