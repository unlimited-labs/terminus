import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useRef } from "react"
import { toast } from "sonner"

import { errorMessage, UNEXPECTED_ERROR, type AppError, type Result } from "@/messages.pl"

export const toastFailure = (failure: AppError) => toast.error(errorMessage(failure))

export function toastUnexpected(error: unknown) {
  console.error(error)
  toast.error(UNEXPECTED_ERROR)
}

/**
 * Mutacja funkcji serwerowej zwracającej `Result`: błąd domeny → komunikat, potem odświeżenie zapytań `invalidate`.
 * `mutate` ignoruje wywołania w trakcie poprzedniego (podwójne kliknięcie, przytrzymany Enter):
 * `isPending` dociera do komponentu asynchronicznie, więc samo `disabled` nie wystarcza.
 */
export function useResultMutation<TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  invalidate: QueryKey[],
  onOk?: (result: { ok: true } & TOut) => void,
) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: (result) => {
      if (result.ok) onOk?.(result)
      else toastFailure(result)
    },
    onError: toastUnexpected,
    onSettled: () =>
      Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
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
