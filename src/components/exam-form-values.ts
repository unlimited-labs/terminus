import type { z } from "zod"

import { warsawDay, warsawTime } from "@/domain/time"
import type { examSchema } from "@/schemas/exam"
import type { ExamDetail } from "@/server/exam-state.server"

export type ExamValues = z.infer<typeof examSchema>

/** Wartości formularza: bez zaliczenia — nowe, z zaliczeniem — jego ustawienia. */
export function examFormValues(
  exam?: Pick<
    ExamDetail,
    | "name"
    | "description"
    | "defaultSlotMinutes"
    | "maxTeamSize"
    | "assignmentMode"
    | "requireEmailLogin"
    | "fields"
    | "enrollmentOpensAt"
  >,
): ExamValues {
  if (!exam) {
    return {
      name: "",
      description: "",
      defaultSlotMinutes: 15,
      maxTeamSize: 1,
      assignmentMode: "RANDOM",
      requireEmailLogin: false,
      fields: [],
      opensDate: "",
      opensTime: "",
    }
  }
  const opensAt = exam.enrollmentOpensAt
  return {
    name: exam.name,
    description: exam.description,
    defaultSlotMinutes: exam.defaultSlotMinutes,
    maxTeamSize: exam.maxTeamSize,
    assignmentMode: exam.assignmentMode,
    requireEmailLogin: exam.requireEmailLogin,
    fields: exam.fields,
    opensDate: opensAt ? warsawDay(opensAt) : "",
    opensTime: opensAt ? warsawTime(opensAt) : "",
  }
}
