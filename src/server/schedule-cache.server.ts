import type { Schedule } from "./schedule.ts"

const TTL_MS = 1000
// shortcut: pamięć w procesie, jedna instancja aplikacji; przy replikach wspólna pamięć albo bez niej.
const cache = new Map<string, Promise<Schedule | null>>()

export function forgetSchedule(examId: string) {
  cache.delete(examId)
}

/**
 * Obietnica w pamięci od startu pobrania (pobranie sprzed `emitExamChange` do niej nie wraca), najwyżej 1 s.
 * `now` świeże per żądanie; reszta wyniku współdzielona między żądaniami: nie mutować.
 */
export async function cachedSchedule(
  examId: string,
  load: (examId: string) => Promise<Schedule | null>,
): Promise<Schedule | null> {
  let promise = cache.get(examId)
  if (!promise) {
    const started = load(examId)
    const drop = () => {
      if (cache.get(examId) === started) cache.delete(examId)
    }
    cache.set(examId, started)
    setTimeout(drop, TTL_MS)
    started.catch(drop)
    promise = started
  }
  const schedule = await promise
  return schedule && { ...schedule, now: new Date() }
}
