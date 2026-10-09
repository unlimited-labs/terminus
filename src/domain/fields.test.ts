import { expect, test } from "vitest"

import { checkAnswers, teacherAnswers, type ExamField } from "./fields"

const fields: ExamField[] = [
  { id: "title", label: "Tytuł projektu", required: true },
  { id: "notes", label: "Uwagi", required: false },
]

test("przycina odpowiedzi, pomija puste i nieznane pola", () => {
  expect(checkAnswers(fields, { title: "  Robot  ", notes: " ", other: "x" })).toEqual({
    ok: true,
    answers: { title: "Robot" },
  })
})

test("brak wymaganej odpowiedzi podaje nazwy pól", () => {
  expect(checkAnswers(fields, { title: "   ", notes: "coś" })).toEqual({
    ok: false,
    code: "MISSING_ANSWER",
    labels: ["Tytuł projektu"],
  })
})

test("poprawka prowadzącego czyści jak zapis, ale nie wymaga pól", () => {
  expect(teacherAnswers(fields, { title: " ", notes: " x ", other: "y" })).toEqual({ notes: "x" })
})

test("zaliczenie bez pól przyjmuje pusty zestaw", () => {
  expect(checkAnswers([], {})).toEqual({ ok: true, answers: {} })
})
