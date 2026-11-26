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

test("wybrany slot zajmuje ktoś inny → toast, wpisane dane zostają", async ({ page, browser }) => {
  const examId = exams().livePick
  await page.goto(`/z/${examId}`)
  await (await hydrated(page.getByRole("button", { name: /^09:00.*wolny/ }))).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Numer indeksu").fill("990011")
  await dialog.getByLabel("Temat (opcjonalnie)").fill("Robot")

  const other = await browser.newPage()
  await other.goto(`/z/${examId}`)
  await (await hydrated(other.getByRole("button", { name: /^09:00.*wolny/ }))).click()
  await other.getByLabel("Numer indeksu").fill("990012")
  await other.getByRole("button", { name: /^Zapisz się na/ }).click()
  await expect(other.getByRole("dialog")).toContainText("Beata Bor")
  await other.close()

  await expect(page.getByText("Wybrany slot zajął ktoś inny. Wybierz inny.")).toBeVisible()
  await expect(dialog).toContainText("Nie wybrano slotu")
  await expect(dialog.getByLabel("Numer indeksu")).toHaveValue("990011")
  await expect(dialog.getByLabel("Temat (opcjonalnie)")).toHaveValue("Robot")

  // Własny zapis zajmuje slot, ale nie pokazuje toastu.
  const toast = page.getByText("Wybrany slot zajął ktoś inny. Wybierz inny.")
  await expect(toast).toBeHidden({ timeout: 10_000 })
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: /^09:20.*wolny/ }).click()
  await dialog.getByLabel("Numer indeksu").fill("990011")
  await dialog.getByRole("button", { name: /^Zapisz się na/ }).click()
  await expect(dialog).toContainText("Adam Ar")
  // Po odświeżeniu harmonogramu (pod otwartym panelem, stąd includeHidden) slot ma skład zespołu.
  await expect(
    page.getByRole("button", { name: /^09:20.*Twój slot: .+/, includeHidden: true }),
  ).toBeAttached()
  // Jednorazowy odczyt: `toBeHidden` czekałby, aż toast sam zniknie, i przechodziłby zawsze.
  await page.waitForTimeout(500)
  expect(await toast.isVisible()).toBe(false)
})

test("po zapisie ustawień formularz bierze zmianę drugiego prowadzącego", async ({
  page,
  browser,
}) => {
  const url = `/zaliczenia/${exams().liveSettings}?tab=ustawienia`
  await login(page)
  await page.clock.install()
  await page.goto(url)
  const name = await hydrated(page.getByLabel("Nazwa (z nazwą przedmiotu)"))
  await name.fill("Ustawienia A E2E")
  await page.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(page.getByText("Zapisano zmiany.")).toBeVisible()
  await expect(name).toHaveValue("Ustawienia A E2E")

  const other = await browser.newPage({ storageState: await page.context().storageState() })
  await other.goto(url)
  await (await hydrated(other.getByLabel("Opis i miejsce"))).fill("Sala B")
  await other.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(other.getByText("Zapisano zmiany.")).toBeVisible()
  await other.close()

  // Odświeżenie pod otwartym formularzem: dane starsze niż staleTime i powrót na kartę.
  await page.clock.fastForward("00:31")
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByLabel("Opis i miejsce")).toHaveValue("Sala B")
  await expect(name).toHaveValue("Ustawienia A E2E")
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
