import { randomInt } from "node:crypto"

import {
  planChoice,
  planEnrollment,
  planLookup,
  type AssignmentMode,
  type EnrollmentPlan,
} from "../domain/draw.ts"
import { checkAnswers, filledAnswers, type Answers, type AnswersCheck } from "../domain/fields.ts"

import { withExamLock } from "./exam-access.server.ts"
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
  | { ok: false; code: "NOT_FOUND" | "BUSY" | "NOT_YOUR_INDEX" }
  | { ok: false; code: "MODE_CHANGED"; assignmentMode: AssignmentMode }

/**
 * Zapis zespołu z losowaniem slotu; sprawdzenia, losowanie i wstawienie pod blokadą zaliczenia.
 * „Teraz” jest brane po uzyskaniu blokady; w chwili otwarcia zapisów kolejka może czekać sekundy.
 * `now` i `timeout` ustawiają tylko testy.
 */
export async function enrollTeam(
  examId: string,
  studentNumbers: string[],
  rawAnswers: Answers = {},
  {
    shownMode = "RANDOM",
    slotId,
    sessionEmail,
    now = () => new Date(),
    timeout,
  }: {
    shownMode?: AssignmentMode
    slotId?: string
    /** Adres zalogowanego studenta (opcja logowania mailem): zespół musi zawierać jego indeks. */
    sessionEmail?: string
    now?: () => Date
    timeout?: number
  } = {},
): Promise<EnrollmentOutcome> {
  return withExamLock(
    examId,
    "public",
    async (tx): Promise<EnrollmentOutcome> => {
      // Wpisy tylko zespołu (plan sprawdza wyłącznie podane numery), ze wszystkich list naraz.
      const [exam, entries] = await Promise.all([
        tx.exam.findUniqueOrThrow({
          where: { id: examId },
          select: {
            assignmentMode: true,
            maxTeamSize: true,
            fields: true,
            enrollmentOpensAt: true,
            enrollments: { select: { studentNumber: true, slotId: true } },
            rosters: {
              select: {
                slots: { select: { id: true, rosterId: true, startsAt: true, endsAt: true } },
              },
            },
          },
        }),
        tx.rosterEntry.findMany({
          where: { examId, studentNumber: { in: studentNumbers } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            studentNumber: true,
            rosterId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        }),
      ])
      if (exam.assignmentMode !== shownMode) {
        return { ok: false, code: "MODE_CHANGED", assignmentMode: exam.assignmentMode }
      }
      const own = sessionEmail?.toLowerCase()
      // Przed planem, żeby brak własnego indeksu nie zdradzał, które numery są na liście.
      const mine =
        own === undefined ? undefined : entries.find((e) => e.email.toLowerCase() === own)
      if (own !== undefined && !mine) return { ok: false, code: "NOT_YOUR_INDEX" }
      // Zalogowany jest zapisującym: jego lista wyznacza termin, niezależnie od kolejności w formularzu.
      const ordered = mine
        ? [
            mine.studentNumber,
            ...studentNumbers.toSpliced(studentNumbers.indexOf(mine.studentNumber), 1),
          ]
        : studentNumbers
      const data = {
        maxTeamSize: exam.maxTeamSize,
        opensAt: exam.enrollmentOpensAt,
        entries,
        slots: exam.rosters.flatMap((r) => r.slots),
        enrollments: exam.enrollments,
      }
      const plan =
        shownMode === "RANDOM"
          ? planEnrollment(data, ordered, now(), randomInt)
          : slotId
            ? planChoice(data, ordered, slotId, now())
            : planLookup(data, ordered, now())
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
      const { startsAt, endsAt } = data.slots.find((s) => s.id === plan.slotId)!
      const team = entries.map(({ studentNumber, firstName, lastName }) => ({
        studentNumber,
        firstName,
        lastName,
      }))
      const shown = filledAnswers(fields, answers)
      return { ok: true, slotId: plan.slotId, ticket: { startsAt, endsAt, team, answers: shown } }
    },
    timeout,
  )
}
