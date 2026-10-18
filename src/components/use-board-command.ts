import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { toast } from "sonner"

import { toastFailure, toastUnexpected } from "@/components/use-result-mutation"
import { enqueue, settle, type BoardCommand, type BoardQueue } from "@/domain/board"
import { firstIssue } from "@/messages.pl"
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
export function useBoardCommand(exam: ExamDetail) {
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
      toast.error(firstIssue(checked.error))
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
