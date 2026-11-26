import { EventEmitter } from "node:events"

import { consola } from "consola"

import { forgetSchedule } from "./schedule-cache.server.ts"

// shortcut: sygnały w pamięci procesu, jedna instancja aplikacji; przy replikach Postgres LISTEN/NOTIFY.
const emitter = new EventEmitter()
// Do ~300 otwartych kart na zaliczenie; ostrzeżenie o „wycieku” przy 11 słuchaczach byłoby fałszywe.
emitter.setMaxListeners(0)

const WINDOW_MS = 1000
/** Zaliczenia z otwartym oknem łączenia → czy w oknie przyszedł kolejny sygnał. */
const changedInWindow = new Map<string, boolean>()

/** Sygnał od razu i okno łączenia; sygnał z okna idzie na jego końcu i otwiera następne. */
function sendAndOpenWindow(examId: string) {
  changedInWindow.set(examId, false)
  try {
    emitter.emit(examId)
  } catch (e) {
    // Błąd słuchacza nie może zamienić zapisanej zmiany w błąd zapisu.
    consola.error(`sygnał examId=${examId}`, e)
  }
  setTimeout(() => {
    const changed = changedInWindow.get(examId)
    changedInWindow.delete(examId)
    if (changed) sendAndOpenWindow(examId)
  }, WINDOW_MS)
}

/** Sygnał „zaliczenie się zmieniło”: pierwszy od razu, kolejne najwyżej raz na sekundę, ostatni zawsze dochodzi. */
export function emitExamChange(examId: string) {
  forgetSchedule(examId)
  if (changedInWindow.has(examId)) changedInWindow.set(examId, true)
  else sendAndOpenWindow(examId)
}

export function onExamChange(examId: string, listener: () => void) {
  emitter.on(examId, listener)
  return () => {
    emitter.off(examId, listener)
  }
}

const PING_MS = 30_000
const encoder = new TextEncoder()
const CHANGE = encoder.encode("data: change\n\n")
const PING = encoder.encode(": ping\n\n")

/** Odpowiedź SSE z sygnałami zaliczenia (bez danych) i pingiem co 30 s; dostęp sprawdza wołający. */
export function changeStream(examId: string, signal: AbortSignal) {
  let stop: () => void
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk)
        } catch {
          stop()
        }
      }
      const off = onExamChange(examId, () => write(CHANGE))
      const ping = setInterval(() => write(PING), PING_MS)
      stop = () => {
        off()
        clearInterval(ping)
        signal.removeEventListener("abort", close)
      }
      const close = () => {
        stop()
        controller.close()
      }
      if (signal.aborted) return close()
      signal.addEventListener("abort", close)
      // Pierwszy bajt wysyła nagłówki od razu: przeglądarka zgłasza `open` bez czekania na ping.
      write(PING)
    },
    cancel: () => stop(),
  })
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  })
}
