import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { examIdSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"
import { loadSchedule } from "./exam-state.server.ts"
import { sessionEmail, studentAccess } from "./student-access.server.ts"

export type Schedule = NonNullable<Awaited<ReturnType<typeof loadSchedule>>>

/** Zaliczenie z logowaniem mailem bez sesji studenta: tylko nazwa i powód, nigdy harmonogram, liczba slotów, termin ani opis. */
type ScheduleView =
  | { gate: "open"; schedule: Schedule; studentIndex: string | null }
  | { gate: "login" | "unavailable"; name: string }

const getSchedule = createServerFn()
  .validator(examIdSchema)
  .handler(async ({ data: { examId } }): Promise<ScheduleView | null> => {
    const access = await studentAccess(examId, await sessionEmail(getRequestHeaders()))
    if (access.kind === "login" || access.kind === "unavailable") {
      const exam = await db.exam.findUnique({ where: { id: examId }, select: { name: true } })
      return exam && { gate: access.kind, name: exam.name }
    }
    const schedule = await loadSchedule(examId)
    if (!schedule) return null
    // Przy wielu indeksach z jednym adresem plakietka pokazuje pierwszy.
    const entry =
      access.kind === "ok"
        ? await db.rosterEntry.findFirst({
            where: { examId, email: { equals: access.email, mode: "insensitive" } },
            orderBy: { studentNumber: "asc" },
            select: { studentNumber: true },
          })
        : null
    return { gate: "open", schedule, studentIndex: entry?.studentNumber ?? null }
  })

export const scheduleQuery = (examId: string) =>
  queryOptions({
    queryKey: ["schedule", examId],
    queryFn: () => getSchedule({ data: { examId } }),
    refetchInterval: 30_000,
  })
