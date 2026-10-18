import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { examQuery } from "@/server/exams"

/** Najpierw nawigacja, potem usunięcie z cache: odwrotnie zamontowana strona pobrałaby je od nowa i mignęło 404. */
export function useLeaveExam(examId: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return () =>
    void navigate({ to: "/" }).then(() =>
      queryClient.removeQueries({ queryKey: examQuery(examId).queryKey }),
    )
}
