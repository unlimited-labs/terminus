import { expect, test } from "vitest"

import { examFormValues } from "./exam-form-values"

const exam = {
  id: "spoza-formularza",
  name: "Kolokwium",
  description: "Sala 1.23",
  defaultSlotMinutes: 20,
  maxTeamSize: 3,
  assignmentMode: "MANUAL" as const,
  requireEmailLogin: true,
  fields: [],
  enrollmentOpensAt: null,
}

test("nowe zaliczenie: wartości domyślne", () => {
  expect(examFormValues()).toEqual({
    name: "",
    description: "",
    defaultSlotMinutes: 15,
    maxTeamSize: 1,
    assignmentMode: "RANDOM",
    requireEmailLogin: false,
    fields: [],
    opensDate: "",
    opensTime: "",
  })
})

test("zaliczenie z datą otwarcia zapisów: dzień i godzina po polsku", () => {
  expect(
    examFormValues({ ...exam, enrollmentOpensAt: new Date("2026-03-02T07:30:00Z") }),
  ).toMatchObject({
    name: "Kolokwium",
    maxTeamSize: 3,
    opensDate: "2026-03-02",
    opensTime: "08:30",
  })
})

test("zaliczenie bez daty otwarcia: puste pola daty i godziny", () => {
  expect(examFormValues(exam)).toEqual({
    name: "Kolokwium",
    description: "Sala 1.23",
    defaultSlotMinutes: 20,
    maxTeamSize: 3,
    assignmentMode: "MANUAL",
    requireEmailLogin: true,
    fields: [],
    opensDate: "",
    opensTime: "",
  })
})
