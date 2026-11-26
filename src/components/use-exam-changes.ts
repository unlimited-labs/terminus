import { useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useEffect, useEffectEvent, useRef } from "react"

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

/**
 * `EventSource` na kanał zmian; `onChange` przy sygnale i przy każdym otwarciu (domyka okno między
 * SSR a podłączeniem, nadrabia przerwę). Sam `EventSource` wznawia tylko po zerwaniu sieci; po
 * odpowiedzi innej niż 200 (502 przy wydaniu, 403) łączymy ponownie z narastającym odstępem,
 * a pierwsze takie zamknięcie w serii też woła `onChange` (przy 403 strona trafi do logowania).
 * Zwraca rozłączenie.
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
 * Strona na żywo: sygnał zmiany zaliczenia unieważnia zapytania `keys` (karta w tle tylko oznacza je
 * nieaktualne; pobranie przy powrocie). Przy `defer` sygnał czeka, aż `defer` znów będzie `false`.
 */
export function useExamChanges(
  examId: string,
  keys: QueryKey[],
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
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey, refetchType })
  })
  useEffect(() => watchExamChanges(`/api/exams/${examId}/changes`, () => onChange()), [examId])
  useEffect(() => {
    if (defer || !pending.current) return
    pending.current = false
    onChange()
  }, [defer])
}
