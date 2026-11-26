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
    source.addEventListener("message", onChange)
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
