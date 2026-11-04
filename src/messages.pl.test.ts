import { expect, test } from "vitest"

import { formatSlotWhen } from "./domain/time"
import { errorMessage, failureNotice, ownSlotMessage } from "./messages.pl"

const startsAt = new Date("2026-10-05T08:00:00Z")

test("już zapisana jedna osoba: informacja o jej slocie, bez podświetlenia", () => {
  const notice = failureNotice(
    { code: "ALREADY_ENROLLED", enrolled: [{ studentNumber: "111", startsAt }] },
    ["111"],
  )
  expect(notice).toEqual({ tone: "info", text: ownSlotMessage(startsAt), flagged: [] })
})

test("zespół z kimś już zapisanym: błąd, podświetlone zapisane indeksy", () => {
  const notice = failureNotice(
    { code: "ALREADY_ENROLLED", enrolled: [{ studentNumber: "222", startsAt }] },
    ["111", "222"],
  )
  expect(notice.tone).toBe("error")
  expect(notice.text).toMatch(/Indeks 222 ma już slot.* Nikogo nie zapisano\.$/)
  expect(notice.flagged).toEqual(["222"])
})

test("indeks spoza listy: błąd, podświetlone wskazane indeksy", () => {
  const notice = failureNotice({ code: "NOT_ON_ROSTER", studentNumbers: ["333"] }, ["111", "333"])
  expect(notice.tone).toBe("error")
  expect(notice.text).toContain("333")
  expect(notice.flagged).toEqual(["333"])
})

test("inny błąd: bez podświetlenia", () => {
  expect(failureNotice({ code: "NO_FREE_SLOTS" }, ["111"]).flagged).toEqual([])
})

test("bez godzin: komunikaty o slocie podają numer slotu, kolizja slotów dalej godziny", () => {
  const slots = [{ startsAt: new Date("2026-10-05T07:40:00Z") }, { startsAt }]
  const when = (at: Date) => formatSlotWhen(at, slots)
  const enrolled = {
    code: "ALREADY_ENROLLED" as const,
    enrolled: [{ studentNumber: "111", startsAt }],
  }
  expect(failureNotice(enrolled, ["111"], when).text).toBe(
    "Masz już zapis: poniedziałek 5 października, slot 2. Slot jest przydzielony na stałe.",
  )
  expect(failureNotice(enrolled, ["111", "222"], when).text).toContain(
    "Indeks 111 ma już slot: poniedziałek 5 października, slot 2.",
  )
  expect(errorMessage({ code: "TEAM_SIZE_BELOW_EXISTING", slots: [startsAt] }, when)).toBe(
    "Są już większe zespoły, w slotach: poniedziałek 5 października, slot 2.",
  )
  const endsAt = new Date("2026-10-05T08:20:00Z")
  expect(errorMessage({ code: "SLOT_OVERLAP", startsAt, endsAt }, when)).toContain("10:00–10:20")
})
