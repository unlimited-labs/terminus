import { expectTypeOf, test } from "vitest"
import type { z } from "zod"

import type { BoardCommand } from "../domain/board.ts"
import type { boardInputSchema } from "./board.ts"

// Sprawdza tsc: nowy wariant BoardCommand bez wariantu w schemacie nie skompiluje się.
test("schemat poleceń tablicy pokrywa BoardCommand", () => {
  expectTypeOf<z.infer<typeof boardInputSchema>["command"]>().toEqualTypeOf<BoardCommand>()
})
