import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { examIdSchema } from "../schemas/exam.ts"

import { loadSchedule } from "./exam-state.server.ts"

const getSchedule = createServerFn()
  .validator(examIdSchema)
  .handler(({ data: { examId } }) => loadSchedule(examId))

export type Schedule = NonNullable<Awaited<ReturnType<typeof getSchedule>>>

export const scheduleQuery = (examId: string) =>
  queryOptions({
    queryKey: ["schedule", examId],
    queryFn: () => getSchedule({ data: { examId } }),
    refetchInterval: 30_000,
  })
