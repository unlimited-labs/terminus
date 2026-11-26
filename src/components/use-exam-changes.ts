import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useEffectEvent, useRef } from "react"

import { examChangeKeys } from "@/server/exams"
import { scheduleQuery } from "@/server/schedule"

import { watchExamChanges } from "./watch-exam-changes.ts"

/**
 * Strona na żywo: sygnał zmiany zaliczenia unieważnia jego zapytania (zaliczenie i lista zaliczeń
 * prowadzącego, harmonogram studenta); karta w tle tylko oznacza je nieaktualne, pobranie przy powrocie.
 * Przy `defer` sygnał czeka, aż `defer` znów będzie `false`.
 */
export function useExamChanges(examId: string, { defer = false }: { defer?: boolean } = {}) {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const onChange = useEffectEvent(() => {
    if (defer) {
      pending.current = true
      return
    }
    const refetchType = document.hidden ? "none" : "active"
    for (const queryKey of [...examChangeKeys(examId), scheduleQuery(examId).queryKey])
      void queryClient.invalidateQueries({ queryKey, refetchType })
  })
  useEffect(() => watchExamChanges(`/api/exams/${examId}/changes`, () => onChange()), [examId])
  useEffect(() => {
    if (defer || !pending.current) return
    pending.current = false
    onChange()
  }, [defer])
}
