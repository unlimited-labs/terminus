import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage, UNEXPECTED_ERROR, type Result } from "@/messages.pl"

/** Mutacja funkcji serwerowej zwracającej `Result`: błąd domeny → komunikat, potem odświeżenie `invalidate`. */
export function useResultMutation<TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  invalidate: QueryKey,
  onOk?: (result: { ok: true } & TOut) => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: (result) => {
      if (result.ok) onOk?.(result)
      else toast.error(errorMessage(result))
    },
    onError: (error) => {
      console.error(error)
      toast.error(UNEXPECTED_ERROR)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  })
}
