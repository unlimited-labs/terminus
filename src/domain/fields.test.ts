import { expect, test } from "vitest"

import { checkAnswers, cleanAnswers, filledAnswers, type ExamField } from "./fields"

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

test("czyszczenie bez sprawdzania wymaganych pól", () => {
  expect(cleanAnswers(fields, { title: " ", notes: " x ", other: "y" })).toEqual({ notes: "x" })
})

test("zaliczenie bez pól przyjmuje pusty zestaw", () => {
  expect(checkAnswers([], {})).toEqual({ ok: true, answers: {} })
})

test("wypełnione odpowiedzi w kolejności pól, puste pominięte", () => {
  expect(filledAnswers(fields, { notes: "x", title: "Robot" })).toEqual([
    { label: "Tytuł projektu", value: "Robot" },
    { label: "Uwagi", value: "x" },
  ])
  expect(filledAnswers(fields, { title: "", notes: "x" })).toEqual([{ label: "Uwagi", value: "x" }])
})
