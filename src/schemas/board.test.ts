import { expect, expectTypeOf, test } from "vitest"
import type { z } from "zod"

import type { BoardCommand } from "../domain/board.ts"
import { boardCommandSchema, type boardInputSchema } from "./board.ts"

// Sprawdza tsc: nowy wariant BoardCommand bez wariantu w schemacie nie skompiluje się.
test("schemat poleceń tablicy pokrywa BoardCommand", () => {
  expectTypeOf<z.infer<typeof boardInputSchema>["command"]>().toEqualTypeOf<BoardCommand>()
})

test("ocena: tylko wartości enumu, komentarz do 500 znaków", () => {
  const setGrades = (grade: unknown, comment: string | null) =>
    boardCommandSchema.safeParse({ kind: "setGrades", grades: { "123": { grade, comment } } })
      .success
  expect(setGrades("G3_5", null)).toBe(true)
  expect(setGrades(null, "x".repeat(500))).toBe(true)
  expect(setGrades("3,5", null)).toBe(false)
  expect(setGrades("ABSENT", "x".repeat(501))).toBe(false)
})
