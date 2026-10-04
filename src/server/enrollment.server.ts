import { randomInt } from "node:crypto"

import { planEnrollment, type EnrollmentPlan } from "../domain/draw.ts"
import { Prisma } from "../generated/prisma/client.ts"
import { checkAnswers, type Answers, type AnswersCheck } from "../domain/fields.ts"

import { withExamLock } from "./exam-lock.server.ts"
import { parseFields } from "./exam-state.server.ts"

export type Ticket = {
  startsAt: Date
  endsAt: Date
  team: { studentNumber: string; firstName: string; lastName: string }[]
  answers: { label: string; value: string }[]
}

export type EnrollmentOutcome =
  | { ok: true; slotId: string; ticket: Ticket }
  | Exclude<EnrollmentPlan, { ok: true }>
  | Exclude<AnswersCheck, { ok: true }>
  | { ok: false; code: "NOT_FOUND" | "BUSY" }

const isTimeout = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2028"

/**
 * Zapis zespołu z losowaniem slotu; sprawdzenia, losowanie i wstawienie pod blokadą zaliczenia.
 * „Teraz” jest brane po uzyskaniu blokady; w chwili otwarcia zapisów kolejka może czekać sekundy.
 */
export async function enrollTeam(
  examId: string,
  studentNumbers: string[],
  rawAnswers: Answers = {},
  { now = () => new Date(), timeout }: { now?: () => Date; timeout?: number } = {},
): Promise<EnrollmentOutcome> {
  try {
    return (
      (await lockedEnroll(examId, studentNumbers, rawAnswers, now, timeout)) ?? {
        ok: false,
        code: "NOT_FOUND",
      }
    )
  } catch (e) {
    if (isTimeout(e)) return { ok: false, code: "BUSY" }
    throw e
  }
}

function lockedEnroll(
  examId: string,
  studentNumbers: string[],
  rawAnswers: Answers,
  now: () => Date,
  timeout: number | undefined,
) {
  return withExamLock(
    examId,
    null,
    async (tx): Promise<EnrollmentOutcome> => {
      const exam = await tx.exam.findUniqueOrThrow({
        where: { id: examId },
        select: {
          maxTeamSize: true,
          fields: true,
          enrollmentOpensAt: true,
          enrollments: { select: { studentNumber: true, slotId: true } },
          rosters: {
            select: {
              entries: { select: { studentNumber: true, rosterId: true } },
              slots: { select: { id: true, rosterId: true, startsAt: true } },
            },
          },
        },
      })
      const plan = planEnrollment(
        {
          maxTeamSize: exam.maxTeamSize,
          opensAt: exam.enrollmentOpensAt,
          entries: exam.rosters.flatMap((r) => r.entries),
          slots: exam.rosters.flatMap((r) => r.slots),
          enrollments: exam.enrollments,
        },
        studentNumbers,
        now(),
        randomInt,
      )
      if (!plan.ok) return plan
      const fields = parseFields(exam.fields)
      const checked = checkAnswers(fields, rawAnswers)
      if (!checked.ok) return checked
      const { answers } = checked

      await tx.enrollment.createMany({
        data: studentNumbers.map((studentNumber) => ({
          examId,
          studentNumber,
          slotId: plan.slotId,
          answers,
        })),
      })
      const [slot, team] = await Promise.all([
        tx.slot.findUniqueOrThrow({
          where: { id: plan.slotId },
          select: { startsAt: true, endsAt: true },
        }),
        tx.rosterEntry.findMany({
          where: { examId, studentNumber: { in: studentNumbers } },
          select: { studentNumber: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
      ])
      const shown = fields
        .filter((f) => answers[f.id])
        .map((f) => ({ label: f.label, value: answers[f.id]! }))
      return { ok: true, slotId: plan.slotId, ticket: { ...slot, team, answers: shown } }
    },
    timeout,
  )
}
