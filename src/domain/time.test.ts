import { expect, test } from "vitest"

import { formatDateRange } from "./time"

const at = (iso: string) => new Date(`${iso}T10:00:00Z`)
const now = at("2026-10-08")

test("zakres dat: jeden dzień, ten sam miesiąc, przełom miesięcy, inny rok", () => {
  expect(formatDateRange(at("2026-10-28"), at("2026-10-28"), now)).toBe("28 paź")
  expect(formatDateRange(at("2026-10-07"), at("2026-10-10"), now)).toBe("7–10 paź")
  expect(formatDateRange(at("2026-09-30"), at("2026-10-02"), now)).toBe("30 wrz – 2 paź")
  expect(formatDateRange(at("2026-10-05"), at("2030-10-05"), now)).toBe("5 paź – 5 paź 2030")
})
