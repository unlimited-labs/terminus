import { expect, test } from "vitest"

import { currentRosterId } from "./roster-choice"

test("wybrana lista, jedyna lista albo pusto", () => {
  const g1 = { id: "g1" }
  const g2 = { id: "g2" }
  expect(currentRosterId([g1, g2], "g2")).toBe("g2")
  expect(currentRosterId([g1], "usunieta")).toBe("g1")
  expect(currentRosterId([g1, g2], "usunieta")).toBe("")
  expect(currentRosterId([], "")).toBe("")
})
