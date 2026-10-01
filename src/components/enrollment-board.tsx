import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { boardPlugins } from "@/components/board-accessibility"
import { SlotRow, UnenrolledPanel } from "@/components/board-parts"
import { CapacitySummary } from "@/components/exam-settings"
import { SlotAnswers } from "@/components/slot-answers"
import { Input } from "@/components/ui/input"
import { applyCommand, dropCommand, parseDragId, type BoardCommand } from "@/domain/board"
import { formatDayShort, warsawDay } from "@/domain/time"
import { errorMessage, UNEXPECTED_ERROR } from "@/messages.pl"
import { applyBoardCommand } from "@/server/board"
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

function useBoardCommand(exam: ExamDetail) {
  const queryClient = useQueryClient()
  const key = ["exam", exam.id]
  const restore = (previous: ExamDetail | undefined) => queryClient.setQueryData(key, previous)

  const mutation = useMutation({
    mutationFn: (command: BoardCommand) =>
      applyBoardCommand({ data: { examId: exam.id, command } }),
    onMutate: async (command) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ExamDetail>(key)
      if (previous) {
        const optimistic = applyCommand(previous, command)
        if (optimistic.ok) queryClient.setQueryData(key, optimistic.state)
      }
      return { previous }
    },
    onSuccess: (result, command, context) => {
      if (!result.ok) {
        restore(context.previous)
        toast.error(errorMessage(result))
        return
      }
      queryClient.setQueryData(key, result.exam)
      toast.success(
        context.previous ? doneMessage(command, context.previous) : DONE[command.kind],
        {
          action: { label: "Cofnij", onClick: () => mutation.mutate(result.inverse) },
          duration: 6000,
        },
      )
    },
    onError: (error, _command, context) => {
      console.error(error)
      restore(context?.previous)
      toast.error(UNEXPECTED_ERROR)
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
  const freeSlots = exam.slots.filter((s) => !taken.has(s.id)).length

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
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-semibold">Dzień</th>
                  <th className="px-2 py-2 font-semibold">Godzina</th>
                  {multi && <th className="px-2 py-2 font-semibold">Lista</th>}
                  <th className="px-2 py-2 font-semibold">Zespół</th>
                </tr>
              </thead>
              <tbody>
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
              </tbody>
            </table>
            {exam.slots.length === 0 && (
              <p className="p-4 text-muted-foreground">Zaliczenie nie ma jeszcze slotów.</p>
            )}
          </div>
        </div>
      </div>
    </DragDropProvider>
  )
}
