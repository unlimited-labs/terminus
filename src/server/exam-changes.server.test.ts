import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { changeStream, emitExamChange, onExamChange } from "./exam-changes.server.ts"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function listen(examId: string) {
  const listener = vi.fn<() => void>()
  return { listener, off: onExamChange(examId, listener) }
}

test("pierwszy sygnał od razu, seria w ciągu sekundy = jeden końcowy", () => {
  const { listener } = listen("a")
  emitExamChange("a")
  expect(listener).toHaveBeenCalledTimes(1)

  emitExamChange("a")
  emitExamChange("a")
  vi.advanceTimersByTime(999)
  expect(listener).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(1)
  expect(listener).toHaveBeenCalledTimes(2)

  // Końcowy otwiera nowe okno: kolejny sygnał znów czeka do jego końca.
  emitExamChange("a")
  expect(listener).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(1000)
  expect(listener).toHaveBeenCalledTimes(3)

  // Okno bez sygnałów się zamyka: następny idzie od razu.
  vi.advanceTimersByTime(1000)
  emitExamChange("a")
  expect(listener).toHaveBeenCalledTimes(4)
})

test("osobno per zaliczenie", () => {
  const a = listen("a2")
  const b = listen("b2")
  emitExamChange("a2")
  emitExamChange("b2")
  expect(a.listener).toHaveBeenCalledTimes(1)
  expect(b.listener).toHaveBeenCalledTimes(1)
})

test("odpięty słuchacz nie dostaje sygnałów", () => {
  const { listener, off } = listen("c")
  off()
  emitExamChange("c")
  expect(listener).not.toHaveBeenCalled()
})

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value, done } = await reader.read()
  return done ? null : new TextDecoder().decode(value)
}

test("strumień: nagłówki SSE, sygnał bez danych, ping co 30 s, zamknięcie odpina", async () => {
  const abort = new AbortController()
  const response = changeStream("d", abort.signal)
  expect(Object.fromEntries(response.headers)).toMatchObject({
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "x-accel-buffering": "no",
  })
  const reader = response.body!.getReader()
  expect(await readText(reader)).toMatch(/^:/)

  emitExamChange("d")
  expect(await readText(reader)).toBe("data: change\n\n")

  vi.advanceTimersByTime(30_000)
  expect(await readText(reader)).toBe(": ping\n\n")

  abort.abort()
  expect(await readText(reader)).toBeNull()
  // Okno łączenia sygnału wygasa; po nim nie zostaje żaden timer (ping zatrzymany).
  vi.advanceTimersByTime(1000)
  expect(vi.getTimerCount()).toBe(0)
})

test("anulowanie strumienia przez odbiorcę też zatrzymuje ping", async () => {
  const response = changeStream("e", new AbortController().signal)
  await response.body!.cancel()
  expect(vi.getTimerCount()).toBe(0)
})
