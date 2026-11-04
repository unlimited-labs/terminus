import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useRef } from "react"
import { toast } from "sonner"

import type { SlotWhen } from "@/domain/time"
import { errorMessage, UNEXPECTED_ERROR, type AppError, type Result } from "@/messages.pl"
import { examChangeKeys } from "@/server/exams"

export const toastFailure = (failure: AppError, when?: SlotWhen) =>
  toast.error(errorMessage(failure, when))

export function toastUnexpected(error: unknown) {
  console.error(error)
  toast.error(UNEXPECTED_ERROR)
}

/**
 * Mutacja funkcji serwerowej zwracającej `Result`: błąd domeny → komunikat; odświeżenie zapytań `invalidate`, potem `onOk`.
 * `mutate` ignoruje wywołania w trakcie poprzedniego (podwójne kliknięcie, przytrzymany Enter):
 * `isPending` dociera do komponentu asynchronicznie, więc samo `disabled` nie wystarcza.
 * `when`: jak komunikat błędu pokazuje chwilę slotu (domyślnie z godziną).
 */
export function useResultMutation<TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  invalidate: QueryKey[],
  onOk?: (result: { ok: true } & TOut) => void,
  when?: SlotWhen,
) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: (result) => {
      if (!result.ok) toastFailure(result, when)
    },
    onError: toastUnexpected,
    onSettled: async (result) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      if (result?.ok) onOk?.(result)
    },
  })
  const mutate = (data: TInput) => {
    if (inFlight.current) return
    inFlight.current = true
    mutation.mutate(data, {
      onSettled: () => {
        inFlight.current = false
      },
    })
  }
  return { ...mutation, mutate }
}

/** Mutacja zmieniająca zaliczenie: odświeża je i listę zaliczeń. */
export const useExamMutation = <TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  examId: string,
  onOk?: (result: { ok: true } & TOut) => void,
  when?: SlotWhen,
) => useResultMutation(fn, examChangeKeys(examId), onOk, when)
