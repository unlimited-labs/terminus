import { expect, test } from "vitest"

import { failureNotice, ownSlotMessage } from "./messages.pl"

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
