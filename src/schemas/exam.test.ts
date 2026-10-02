import { expect, test } from "vitest"

import { examFormSchema, hhmm } from "./exam"
import { windowSchema } from "./slot"

test("godzina HH:MM: przyjmuje 00:00–23:59, odrzuca resztę", () => {
  for (const ok of ["00:00", "09:00", "23:59"]) expect(hhmm.safeParse(ok).success).toBe(true)
  for (const bad of ["24:00", "27:00", "08:75", "9:00", "d2:d2", ""])
    expect(hhmm.safeParse(bad).success).toBe(false)
})

test("start zapisów 2026-10-06 09:00 przechodzi przez schemat zaliczenia", () => {
  const exam = {
    name: "Kolokwium",
    description: "",
    defaultSlotMinutes: 15,
    maxTeamSize: 1,
    fields: [],
    opensDate: "2026-10-06",
  }
  expect(examFormSchema.safeParse({ ...exam, opensTime: "09:00" }).success).toBe(true)
  expect(examFormSchema.safeParse({ ...exam, opensTime: "24:00" }).success).toBe(false)
})

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
