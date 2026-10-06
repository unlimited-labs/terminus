import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { boardPlugins } from "@/components/board-accessibility"
import { SlotRow, UnenrolledPanel } from "@/components/board-parts"
import { CapacitySummary } from "@/components/exam-settings"
import { SlotAnswers } from "@/components/slot-answers"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { applyCommand, dropCommand, parseDragId, type BoardCommand } from "@/domain/board"
import { isFreeSlot } from "@/domain/schedule"
import { formatDayShort, warsawDay } from "@/domain/time"
import { errorMessage, UNEXPECTED_ERROR } from "@/messages.pl"
import { applyBoardCommand, boardMutationKey } from "@/server/board"
import type { ExamDetail } from "@/server/exam-state.server"

const DONE: Record<BoardCommand["kind"], string> = {
  move: "Przeniesiono.",
  swapPeople: "Zamieniono sloty dwóch osób.",
  swapSlots: "Przeniesiono zespół.",
  rename: "Zmieniono imię i nazwisko.",
}

function doneMessage(command: BoardCommand, exam: ExamDetail) {
  if (command.kind !== "move") return DONE[command.kind]
  if (command.toSlotId === null) return "Usunięto zapis."
  const before = exam.people.find((p) => p.studentNumber === command.studentNumber)
  return before?.slotId === null ? "Zapisano ręcznie." : DONE.move
}

const replay = (state: ExamDetail, commands: BoardCommand[]) =>
  commands.reduce((s, c) => {
    const next = applyCommand(s, c)
    return next.ok ? next.state : s
  }, state)

/**
 * Polecenia idą do serwera po kolei (wspólny `scope`). Po każdym tablica = ostatni znany stan
 * z serwera + optymistycznie polecenia wciąż w kolejce; nieudane polecenie po prostu znika.
 */
function useBoardCommand(exam: ExamDetail) {
  const queryClient = useQueryClient()
  const key = ["exam", exam.id]
  const mutationKey = boardMutationKey(exam.id)
  const server = useRef<ExamDetail | undefined>(undefined)
  const pending = useRef<BoardCommand[]>([])

  const queued = (except: BoardCommand) => pending.current.filter((c) => c !== except)
  const show = (latest: ExamDetail | undefined, settled: BoardCommand) => {
    if (latest) server.current = latest
    if (server.current) queryClient.setQueryData(key, replay(server.current, queued(settled)))
  }

  const mutation = useMutation({
    mutationKey,
    scope: { id: mutationKey.join(":") },
    mutationFn: (command: BoardCommand) =>
      applyBoardCommand({ data: { examId: exam.id, command } }),
    onMutate: async (command) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ExamDetail>(key)
      if (pending.current.length === 0) server.current = previous
      pending.current.push(command)
      if (previous) queryClient.setQueryData(key, replay(previous, [command]))
      return { previous }
    },
    onSuccess: (result, command, context) => {
      if (!result.ok) {
        show(undefined, command)
        toast.error(errorMessage(result))
        return
      }
      show(result.exam, command)
      toast.success(
        context.previous ? doneMessage(command, context.previous) : DONE[command.kind],
        {
          action: { label: "Cofnij", onClick: () => mutation.mutate(result.inverse) },
          duration: 6000,
        },
      )
    },
    onError: (error, command) => {
      console.error(error)
      show(undefined, command)
      toast.error(UNEXPECTED_ERROR)
    },
    onSettled: (_result, _error, command) => {
      pending.current = queued(command)
      if (pending.current.length === 0) void queryClient.invalidateQueries({ queryKey: key })
    },
  })

  const run = (command: BoardCommand) => {
    const local = applyCommand(exam, command)
    if (!local.ok) {
      if (local.code !== "NO_CHANGE") toast.error(errorMessage(local))
      return
    }
    mutation.mutate(command)
  }
  return run
}

export function EnrollmentBoard({ exam }: { exam: ExamDetail }) {
  const [search, setSearch] = useState("")
  const run = useBoardCommand(exam)
  const multi = exam.rosters.length > 1
  const rosterName = new Map(exam.rosters.map((r) => [r.id, r.name]))
  const q = search.trim().toLowerCase()
  const highlight = (p: ExamDetail["people"][number]) =>
    q !== "" &&
    (p.studentNumber.includes(q) || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))

  const onDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const source = operation.source ? parseDragId(operation.source.id) : undefined
    const target = operation.target ? parseDragId(operation.target.id) : undefined
    if (canceled || !source || !target) return
    const command = dropCommand(source, target, exam.people)
    if (command) run(command)
  }

  const enrolled = exam.people.filter((p) => p.slotId !== null).length
  const taken = new Set(exam.people.map((p) => p.slotId))
  const now = new Date()
  const freeSlots = exam.slots.filter((s) => isFreeSlot(s, taken.has(s.id) ? 1 : 0, now)).length

  return (
    <DragDropProvider plugins={boardPlugins} onDragEnd={onDragEnd}>
      <div className="grid gap-4">
        <header className="grid gap-2">
          <h1 className="text-2xl font-extrabold">{exam.name} — tablica zapisów</h1>
          <p className="tabular-nums text-muted-foreground">
            zapisani {enrolled} / {exam.people.length} · wolne sloty {freeSlots} · miejsca{" "}
            {exam.slots.length * exam.maxTeamSize}
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
                  return (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      team={exam.people.filter((p) => p.slotId === slot.id)}
                      dayLabel={firstOfDay ? formatDayShort(slot.startsAt) : null}
                      rosterName={multi ? rosterName.get(slot.rosterId) : undefined}
                      maxTeamSize={exam.maxTeamSize}
                      rosterOf={(id) => rosterName.get(id)}
                      highlight={highlight}
                      onCommand={run}
                      extra={
                        exam.fields.length > 0 && slot.answers && taken.has(slot.id) ? (
                          <SlotAnswers
                            examId={exam.id}
                            slotId={slot.id}
                            fields={exam.fields}
                            answers={slot.answers}
                          />
                        ) : null
                      }
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
    </DragDropProvider>
  )
}
