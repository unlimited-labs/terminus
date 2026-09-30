import { randomInt } from "node:crypto"

import { planEnrollment, type EnrollmentPlan } from "../domain/draw.ts"

import { withExamLock } from "./exam-lock.server.ts"

export type Ticket = {
  startsAt: Date
  endsAt: Date
  team: { studentNumber: string; firstName: string; lastName: string }[]
}

export type EnrollmentOutcome =
  | { ok: true; slotId: string; ticket: Ticket }
  | Exclude<EnrollmentPlan, { ok: true }>
  | { ok: false; code: "NOT_FOUND" }

/** Zapis zespołu z losowaniem slotu; sprawdzenia, losowanie i wstawienie pod blokadą zaliczenia. */
export async function enrollTeam(
  examId: string,
  studentNumbers: string[],
  now = new Date(),
): Promise<EnrollmentOutcome> {
  const outcome = await withExamLock(examId, null, async (tx): Promise<EnrollmentOutcome> => {
    const exam = await tx.exam.findUniqueOrThrow({
      where: { id: examId },
      select: {
        maxTeamSize: true,
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
        entries: exam.rosters.flatMap((r) => r.entries),
        slots: exam.rosters.flatMap((r) => r.slots),
        enrollments: exam.enrollments,
      },
      studentNumbers,
      now,
      randomInt,
    )
    if (!plan.ok) return plan

    await tx.enrollment.createMany({
      data: studentNumbers.map((studentNumber) => ({ examId, studentNumber, slotId: plan.slotId })),
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
    return { ok: true, slotId: plan.slotId, ticket: { ...slot, team } }
  })
  return outcome ?? { ok: false, code: "NOT_FOUND" }
}
