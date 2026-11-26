import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { watchExamChanges } from "./use-exam-changes.ts"

/** `EventSource` z ręcznie wywoływanymi zdarzeniami; `readyState` jak w przeglądarce. */
class FakeEventSource extends EventTarget {
  static readonly CLOSED = 2
  static all: FakeEventSource[] = []
  readyState = 0
  closed = false
  constructor(readonly url: string) {
    super()
    FakeEventSource.all.push(this)
  }
  open() {
    this.readyState = 1
    this.dispatchEvent(new Event("open"))
  }
  message() {
    this.dispatchEvent(new Event("message"))
  }
  /** Odpowiedź inna niż 200 (np. 502): przeglądarka zamyka na stałe i zgłasza `error`. */
  fail() {
    this.readyState = FakeEventSource.CLOSED
    this.dispatchEvent(new Event("error"))
  }
  close() {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }
}

const last = () => FakeEventSource.all.at(-1)!

beforeEach(() => {
  vi.useFakeTimers()
  FakeEventSource.all = []
  vi.stubGlobal("EventSource", FakeEventSource)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test("sygnał i każde otwarcie unieważniają; rozłączenie zamyka", () => {
  const onChange = vi.fn<() => void>()
  const stop = watchExamChanges("/api/exams/x/changes", onChange)
  expect(last().url).toBe("/api/exams/x/changes")
  last().open()
  last().message()
  expect(onChange).toHaveBeenCalledTimes(2)
  stop()
  expect(last().closed).toBe(true)
})

test("zamknięty na stałe: raz unieważnia, łączy się ponownie z narastającym odstępem", () => {
  const onChange = vi.fn<() => void>()
  const stop = watchExamChanges("/x", onChange)
  last().open()
  onChange.mockClear()

  last().fail()
  expect(onChange).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(1000)
  expect(FakeEventSource.all).toHaveLength(2)

  last().fail()
  vi.advanceTimersByTime(1999)
  expect(FakeEventSource.all).toHaveLength(2)
  vi.advanceTimersByTime(1)
  expect(FakeEventSource.all).toHaveLength(3)
  // Kolejne nieudane próby w tej samej serii już nie unieważniają.
  expect(onChange).toHaveBeenCalledTimes(1)

  // Udane wznowienie nadrabia przegapione sygnały i zeruje odstęp.
  last().open()
  expect(onChange).toHaveBeenCalledTimes(2)
  last().fail()
  vi.advanceTimersByTime(1000)
  expect(FakeEventSource.all).toHaveLength(4)

  // Rozłączenie w czasie odstępu: bez kolejnej próby.
  last().fail()
  stop()
  vi.advanceTimersByTime(60_000)
  expect(FakeEventSource.all).toHaveLength(4)
})

test("odstęp rośnie najwyżej do 30 s", () => {
  watchExamChanges("/x", () => {})
  for (const [i, wait] of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000].entries()) {
    last().fail()
    vi.advanceTimersByTime(wait - 1)
    expect(FakeEventSource.all).toHaveLength(i + 1)
    vi.advanceTimersByTime(1)
    expect(FakeEventSource.all).toHaveLength(i + 2)
  }
})
