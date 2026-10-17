import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { boardPlugins } from "@/components/board-accessibility"
import { BoardSlotRow, UnenrolledPanel } from "@/components/board-parts"
import { gradedCount, useUnenrollGuard } from "@/components/grading"
import { hasManyRosters, rosterNames } from "@/components/roster-choice"
import { CapacitySummary } from "@/components/slot-section"
import { Input } from "@/components/ui/input"
import { toastFailure, toastUnexpected } from "@/components/use-result-mutation"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  dropCommand,
  enqueue,
  parseDragId,
  settle,
  type BoardCommand,
  type BoardQueue,
} from "@/domain/board"
import { examCounts, fullName } from "@/domain/schedule"
import { formatDayShort, warsawDay } from "@/domain/time"
import { UNEXPECTED_ERROR } from "@/messages.pl"
import { boardCommandSchema } from "@/schemas/board"
import { applyBoardCommand } from "@/server/board"
import { examChangeKeys, examQuery } from "@/server/exams"
import type { ExamDetail } from "@/server/exam-state.server"

const DONE_MESSAGES: Record<BoardCommand["kind"], string> = {
  move: "Przeniesiono.",
  swapPeople: "Zamieniono sloty dwóch osób.",
  swapSlots: "Przeniesiono zespół.",
  rename: "Zmieniono imię i nazwisko.",
  unenrollTeam: "Usunięto zapis zespołu.",
  enrollTeam: "Przywrócono zespół.",
  setAnswers: "Zapisano odpowiedzi zespołu.",
  setGrades: "Zapisano ocenę.",
}

function doneMessage(command: BoardCommand, exam: ExamDetail) {
  if (command.kind !== "move") return DONE_MESSAGES[command.kind]
  if (command.toSlotId === null) return "Usunięto zapis."
  const before = exam.people.find((p) => p.studentNumber === command.studentNumber)
  return before?.slotId === null ? "Zapisano ręcznie." : DONE_MESSAGES.move
}

/** Klucz poleceń tablicy: kolejka (scope) i wstrzymanie odświeżania w trakcie. */
const boardMutationKey = (examId: string) => ["board", examId]

export const useBoardBusy = (examId: string) =>
  useIsMutating({ mutationKey: boardMutationKey(examId) }) > 0

/**
 * Polecenia idą do serwera po kolei (wspólny `scope`); tablica pokazuje stan z kolejki
 * (`enqueue`/`settle` w domain/board), a po opróżnieniu kolejki odświeża zaliczenie.
 */
function useBoardCommand(exam: ExamDetail) {
  const queryClient = useQueryClient()
  const key = examQuery(exam.id).queryKey
  const mutationKey = boardMutationKey(exam.id)
  const queue = useRef<BoardQueue<ExamDetail>>(null)

  const mutation = useMutation({
    mutationKey,
    scope: { id: mutationKey.join(":") },
    mutationFn: ({ command }: { command: BoardCommand; message: string }) =>
      applyBoardCommand({ data: { examId: exam.id, command } }),
    onSuccess: (result, { message }) => {
      if (!result.ok) {
        if (result.code !== "NO_CHANGE") toastFailure(result)
        return
      }
      toast.success(message, {
        action: { label: "Cofnij", onClick: () => run(result.inverse) },
        duration: 6000,
      })
    },
    onError: toastUnexpected,
    onSettled: (result, _error, { command }) => {
      const settled = settle(queue.current!, command, result?.ok ? result.exam : undefined)
      queue.current = settled.queue
      queryClient.setQueryData(key, settled.shown)
      if (settled.queue) return
      for (const queryKey of examChangeKeys(exam.id))
        void queryClient.invalidateQueries({ queryKey })
    },
  })

  function run(command: BoardCommand) {
    const checked = boardCommandSchema.safeParse(command)
    if (!checked.success) {
      toast.error(checked.error.issues[0]?.message ?? UNEXPECTED_ERROR)
      return false
    }
    const before = queryClient.getQueryData<ExamDetail>(key) ?? exam
    const added = enqueue(queue.current, before, command)
    if (!added.ok) {
      if (added.code === "NO_CHANGE") return true
      toastFailure(added)
      return false
    }
    queue.current = added.queue
    void queryClient.cancelQueries({ queryKey: key })
    queryClient.setQueryData(key, added.shown)
    mutation.mutate({ command, message: doneMessage(command, before) })
    return true
  }
  return run
}

export function EnrollmentBoard({ exam }: { exam: ExamDetail }) {
  const [search, setSearch] = useState("")
  const { run, dialog } = useUnenrollGuard(exam.people, useBoardCommand(exam))
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
            {exam.slots.length * exam.maxTeamSize} · {gradedCount(exam.people)}
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
