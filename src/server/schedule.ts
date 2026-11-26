import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { examIdSchema } from "../schemas/exam.ts"

import { loadSchedule } from "./exam-state.server.ts"
import { cachedSchedule } from "./schedule-cache.server.ts"
import { sessionEmail, studentAccess, studentAllowed } from "./student-access.server.ts"

export type Schedule = NonNullable<Awaited<ReturnType<typeof loadSchedule>>>

/** Zaliczenie z logowaniem mailem bez sesji studenta: tylko nazwa i powód, nigdy harmonogram, liczba slotów, termin ani opis. */
type ScheduleView =
  | { gate: "open"; schedule: Schedule; studentIndex: string | null }
  | { gate: "login" | "unavailable"; name: string }

const getSchedule = createServerFn()
  .validator(examIdSchema)
  .handler(async ({ data: { examId } }): Promise<ScheduleView | null> => {
    // Harmonogram razem z sesją; przy bramce logowania odpowiedź niesie tylko nazwę.
    const [email, schedule] = await Promise.all([
      sessionEmail(getRequestHeaders()),
      cachedSchedule(examId, loadSchedule),
    ])
    if (!schedule) return null
    const access = await studentAccess(examId, email, schedule.requireEmailLogin)
    if (!studentAllowed(access)) {
      return { gate: access.kind, name: schedule.name }
    }
    const studentIndex = access.kind === "ok" ? access.studentNumber : null
    return { gate: "open", schedule, studentIndex }
  })

export const scheduleQuery = (examId: string) =>
  queryOptions({
    queryKey: ["schedule", examId],
    queryFn: () => getSchedule({ data: { examId } }),
  })
