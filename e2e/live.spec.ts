import { expect, test } from "@playwright/test"

import { dragWithKeyboard, exams, hydrated, login, openBoard, row } from "./helpers.ts"

test("prowadzący przenosi studenta na tablicy → strona studenta zmienia się bez przeładowania", async ({
  page,
  browser,
}) => {
  const examId = exams().liveStudent
  await login(page)
  await openBoard(page, examId)

  const student = await browser.newPage()
  await student.goto(`/z/${examId}`)
  const taken = student.getByRole("button", { name: /zajęty: Bartosz Bąk/ })
  await expect(taken).toHaveAccessibleName(/09:00/)
  await hydrated(taken)

  const tile = page.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await dragWithKeyboard(page, tile, row(page, "09:40–10:00"))
  await expect(page.getByText("Przeniesiono.")).toBeVisible()

  await expect(taken).toHaveAccessibleName(/09:40/)
  await student.close()
})
