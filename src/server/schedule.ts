import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { examIdSchema } from "../schemas/exam.ts"

import { db } from "./db.server.ts"
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
