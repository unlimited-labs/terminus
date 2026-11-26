import { PrismaPg } from "@prisma/adapter-pg"
import { expect, test } from "@playwright/test"

import { PrismaClient } from "../src/generated/prisma/client.ts"

import { databaseUrl, dragWithKeyboard, exams, hydrated, login, openBoard, row } from "./helpers.ts"

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

test("start zapisów za kilka sekund → strona studenta sama otwiera zapisy", async ({ page }) => {
  const examId = exams().liveOpening
  // Wprost w bazie, bez sygnału zmiany: zapisy otwiera sam licznik strony.
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) })
  await db.exam.update({
    where: { id: examId },
    data: { enrollmentOpensAt: new Date(Date.now() + 6000) },
  })
  await db.$disconnect()

  await page.goto(`/z/${examId}`)
  await expect(page.getByRole("status")).toContainText("Zapisy ruszają")
  await expect(page.getByRole("button", { name: "Zapisz się" })).toHaveCount(0)

  await expect(page.getByRole("button", { name: "Zapisz się" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Zapisy ruszają")).toHaveCount(0)
})
