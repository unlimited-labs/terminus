import { expect, test, vi } from "vitest"

import { needsPreview } from "./use-roster-import"

vi.mock("@/server/rosters", () => ({}))
vi.mock("@/components/use-result-mutation", () => ({}))

const input = (rosterName: string) => ({ examId: "e", rosterName, csv: "" })

test("bez wczytanego pliku nie ma czego podglądać", () => {
  expect(needsPreview(null, undefined)).toBe(false)
})

test("pusta albo z samych spacji nazwa nie odświeża podglądu", () => {
  expect(needsPreview(input(""), "g1")).toBe(false)
  expect(needsPreview(input("  "), "g1")).toBe(false)
})

test("nazwa jak w ostatnim podglądzie nie odświeża go", () => {
  expect(needsPreview(input("g1"), "g1")).toBe(false)
})

test("nowa nazwa odświeża podgląd", () => {
  expect(needsPreview(input("g2"), "g1")).toBe(true)
  expect(needsPreview(input("g1"), undefined)).toBe(true)
})
