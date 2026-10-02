import { expect, test } from "vitest"

import { windowSchema } from "./slot"

test("okno slotów odrzuca godziny spoza doby", () => {
  const window = {
    examId: crypto.randomUUID(),
    rosterId: crypto.randomUUID(),
    date: "2026-10-06",
    from: "08:00",
    to: "10:00",
    minutes: 15,
  }
  expect(windowSchema.safeParse(window).success).toBe(true)
  expect(windowSchema.safeParse({ ...window, to: "27:00" }).success).toBe(false)
  expect(windowSchema.safeParse({ ...window, from: "08:75" }).success).toBe(false)
})
