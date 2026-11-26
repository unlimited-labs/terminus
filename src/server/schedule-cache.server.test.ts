import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { emitExamChange } from "./exam-changes.server.ts"
import { cachedSchedule } from "./schedule-cache.server.ts"
import type { Schedule } from "./schedule.ts"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const schedule = (name: string): Schedule => ({
  name,
  description: "",
  teacherNames: "",
  maxTeamSize: 1,
  assignmentMode: "MANUAL",
  requireEmailLogin: false,
  showSlotTimes: true,
  opensAt: null,
  fields: [],
  rosters: [],
  now: new Date(0),
  slots: [],
})

/** Każde pobranie zwraca kolejną wersję: "v1", "v2", … */
function loader() {
  let n = 0
  return vi.fn<(examId: string) => Promise<Schedule | null>>(async () => schedule(`v${++n}`))
}

test("równoczesne żądania = jedno pobranie", async () => {
  const load = loader()
  const [a, b] = await Promise.all([cachedSchedule("s1", load), cachedSchedule("s1", load)])
  expect(load).toHaveBeenCalledTimes(1)
  expect(a?.name).toBe("v1")
  expect(b?.name).toBe("v1")
})

test("emisja kasuje pamięć od razu", async () => {
  const load = loader()
  await cachedSchedule("s2", load)
  emitExamChange("s2")
  expect((await cachedSchedule("s2", load))?.name).toBe("v2")
})

test("po 1 s nowe pobranie", async () => {
  const load = loader()
  await cachedSchedule("s3", load)
  vi.advanceTimersByTime(999)
  expect((await cachedSchedule("s3", load))?.name).toBe("v1")
  vi.advanceTimersByTime(1)
  expect((await cachedSchedule("s3", load))?.name).toBe("v2")
})

test("pobranie rozpoczęte przed emisją nie wraca do pamięci", async () => {
  let finish!: (v: Schedule) => void
  const before = cachedSchedule("s4", () => new Promise((resolve) => (finish = resolve)))
  emitExamChange("s4")
  finish(schedule("stary"))
  expect((await before)?.name).toBe("stary")

  const load = loader()
  expect((await cachedSchedule("s4", load))?.name).toBe("v1")
})

test("nieudane pobranie nie zostaje w pamięci", async () => {
  await expect(cachedSchedule("s5", () => Promise.reject(new Error("db")))).rejects.toThrow("db")
  expect((await cachedSchedule("s5", loader()))?.name).toBe("v1")
})

test("now stemplowany per żądanie, nie z pamięci", async () => {
  const load = loader()
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"))
  const first = await cachedSchedule("s6", load)
  vi.setSystemTime(new Date("2026-01-01T10:00:00.500Z"))
  const second = await cachedSchedule("s6", load)
  expect(load).toHaveBeenCalledTimes(1)
  expect(first?.now).toEqual(new Date("2026-01-01T10:00:00Z"))
  expect(second?.now).toEqual(new Date("2026-01-01T10:00:00.500Z"))
})

test("brak zaliczenia przechodzi jako null", async () => {
  expect(await cachedSchedule("s7", async () => null)).toBeNull()
})
