import { expect, test } from "vitest"

import { currentRosterId, hasManyRosters, rosterNames } from "./roster-choice"

test("wybrana lista, jedyna lista albo pusto", () => {
  const g1 = { id: "g1" }
  const g2 = { id: "g2" }
  expect(currentRosterId([g1, g2], "g2")).toBe("g2")
  expect(currentRosterId([g1], "usunieta")).toBe("g1")
  expect(currentRosterId([g1, g2], "usunieta")).toBe("")
  expect(currentRosterId([], "")).toBe("")
})

test("kilka list i ich nazwy po id", () => {
  const g1 = { id: "g1", name: "Grupa 1" }
  const g2 = { id: "g2", name: "Grupa 2" }
  expect(hasManyRosters([])).toBe(false)
  expect(hasManyRosters([g1])).toBe(false)
  expect(hasManyRosters([g1, g2])).toBe(true)
  expect(rosterNames([g1, g2]).get("g2")).toBe("Grupa 2")
  expect(rosterNames([g1]).get("brak")).toBeUndefined()
})
