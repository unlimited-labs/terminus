import { useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useEffect, useEffectEvent, useRef } from "react"

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

/**
 * `onChange` także przy każdym otwarciu (nadrabia czas od SSR i przerwy). Po odpowiedzi innej niż 200
 * `EventSource` sam nie wznawia, więc łączymy ponownie; pierwsze takie zamknięcie w serii też woła
 * `onChange` (przy 403 strona trafi do logowania).
 */
export function watchExamChanges(url: string, onChange: () => void) {
  let source: EventSource
  let retry: ReturnType<typeof setTimeout> | undefined
  let delay = FIRST_RETRY_MS
  const connect = () => {
    source = new EventSource(url)
    source.addEventListener("open", () => {
      delay = FIRST_RETRY_MS
      onChange()
    })
    source.addEventListener("message", () => onChange())
    source.addEventListener("error", () => {
      if (source.readyState !== EventSource.CLOSED) return
      if (delay === FIRST_RETRY_MS) onChange()
      retry = setTimeout(connect, delay)
      delay = Math.min(delay * 2, MAX_RETRY_MS)
    })
  }
  connect()
  return () => {
    clearTimeout(retry)
    source.close()
  }
}

/**
 * Strona na żywo: sygnał zmiany zaliczenia unieważnia zapytanie `queryKey` (karta w tle tylko oznacza je
 * nieaktualne; pobranie przy powrocie). Przy `defer` sygnał czeka, aż `defer` znów będzie `false`.
 */
export function useExamChanges(
  examId: string,
  queryKey: QueryKey,
  { defer = false }: { defer?: boolean } = {},
) {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const onChange = useEffectEvent(() => {
    if (defer) {
      pending.current = true
      return
    }
    const refetchType = document.hidden ? "none" : "active"
    void queryClient.invalidateQueries({ queryKey, refetchType })
  })
  useEffect(() => watchExamChanges(`/api/exams/${examId}/changes`, () => onChange()), [examId])
  useEffect(() => {
    if (defer || !pending.current) return
    pending.current = false
    onChange()
  }, [defer])
}
