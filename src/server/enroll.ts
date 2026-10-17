import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { consola } from "consola"

import { enrollmentSchema } from "../schemas/enrollment.ts"

import { isBlocked, limitKey, recordOutcome } from "./attempt-limit.server.ts"
import { enrollTeam, type EnrollmentOutcome } from "./enrollment.server.ts"

export const enroll = createServerFn({ method: "POST" })
  .validator(enrollmentSchema)
  .handler(async ({ data }): Promise<EnrollmentOutcome | { ok: false; code: "RATE_LIMITED" }> => {
    const key = limitKey(getRequestHeader("x-real-ip"))
    // Ślad do wyjaśniania zapisów bez wiedzy kolegi (klauzula informacyjna, pkt 12).
    const trace = (result: string) =>
      consola.info(
        `zapis ip=${key} tryb=${data.assignmentMode} slot=${"slotId" in data ? (data.slotId ?? "-") : "-"} indeksy=${data.studentNumbers.join(",")} ${result}`,
      )
    if (await isBlocked(key)) {
      trace("RATE_LIMITED")
      return { ok: false, code: "RATE_LIMITED" }
    }
    const outcome = await enrollTeam(data.examId, data.studentNumbers, data.answers, {
      shownMode: data.assignmentMode,
      slotId: "slotId" in data ? data.slotId : undefined,
    })
    trace(outcome.ok ? "ok" : outcome.code)
    await recordOutcome(key, data.studentNumbers, outcome)
    return outcome
  })
