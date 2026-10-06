import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

import { enrollmentSchema } from "../schemas/enrollment.ts"

import { isBlocked, limitKey, recordOutcome } from "./attempt-limit.server.ts"
import { enrollTeam, type EnrollmentOutcome } from "./enrollment.server.ts"

/** Zapis studenta ze strony `/z/…`: limit prób z IP, potem zapis z losowaniem. */
export const enroll = createServerFn({ method: "POST" })
  .validator(enrollmentSchema)
  .handler(async ({ data }): Promise<EnrollmentOutcome | { ok: false; code: "RATE_LIMITED" }> => {
    const key = limitKey(getRequestHeader("x-real-ip"))
    if (await isBlocked(key)) return { ok: false, code: "RATE_LIMITED" }
    const outcome = await enrollTeam(data.examId, data.studentNumbers, data.answers)
    await recordOutcome(key, data.studentNumbers, outcome)
    return outcome
  })
