import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

import { examIdSchema } from "../schemas/exam.ts"
import { enrollmentSchema } from "../schemas/enrollment.ts"

import { isBlocked, recordFailure } from "./attempt-limit.server.ts"
import { db } from "./db.server.ts"
import { enrollTeam, type EnrollmentOutcome } from "./enrollment.server.ts"
import { parseFields } from "./exam-state.server.ts"

/** Publiczny harmonogram: sloty z imionami i nazwiskami, bez numerów indeksów. */
const getSchedule = createServerFn()
  .validator(examIdSchema)
  .handler(async ({ data: { examId } }) => {
    const exam = await db.exam.findUnique({
      where: { id: examId },
      select: {
        name: true,
        description: true,
        maxTeamSize: true,
        fields: true,
        enrollmentOpensAt: true,
        owner: { select: { name: true } },
        rosters: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    })
    if (!exam) return null
    const slots = await db.slot.findMany({
      where: { examId },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        rosterId: true,
        startsAt: true,
        endsAt: true,
        enrollments: {
          select: { entry: { select: { firstName: true, lastName: true } } },
          orderBy: { entry: { lastName: "asc" } },
        },
      },
    })
    return {
      name: exam.name,
      description: exam.description,
      ownerName: exam.owner.name,
      maxTeamSize: exam.maxTeamSize,
      opensAt: exam.enrollmentOpensAt,
      fields: parseFields(exam.fields),
      rosters: exam.rosters,
      now: new Date(),
      slots: slots.map(({ enrollments, ...slot }) => ({
        ...slot,
        team: enrollments.map((e) => e.entry),
      })),
    }
  })

export type Schedule = NonNullable<Awaited<ReturnType<typeof getSchedule>>>

export const scheduleQuery = (examId: string) =>
  queryOptions({
    queryKey: ["schedule", examId],
    queryFn: () => getSchedule({ data: { examId } }),
    refetchInterval: 30_000,
  })

let warnedNoIp = false

export const enroll = createServerFn({ method: "POST" })
  .validator(enrollmentSchema)
  .handler(async ({ data }): Promise<EnrollmentOutcome | { ok: false; code: "RATE_LIMITED" }> => {
    const ip = getRequestHeader("x-real-ip")
    if (!ip && !warnedNoIp && process.env.NODE_ENV === "production") {
      warnedNoIp = true
      console.warn(
        "Brak nagłówka X-Real-IP: limit prób jest wspólny dla wszystkich (sprawdź reverse proxy).",
      )
    }
    if (await isBlocked(ip ?? "unknown")) return { ok: false, code: "RATE_LIMITED" }
    const outcome = await enrollTeam(data.examId, data.studentNumbers, data.answers)
    if (!outcome.ok && outcome.code === "NOT_ON_ROSTER") await recordFailure(ip ?? "unknown")
    return outcome
  })
