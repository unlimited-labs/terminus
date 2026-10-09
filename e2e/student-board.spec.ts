import { expect, test } from "@playwright/test"

import { dayLabel, exams, login } from "./helpers.ts"

test("ostatni wolny slot dnia: „Pokaż na planszy” wraca na ten dzień i wyróżnia „Twój” slot", async ({
  page,
}) => {
  await page.goto(`/z/${exams().days}`)
  const days = page.getByRole("group", { name: "Dni" })
  await expect(days.getByRole("button", { pressed: true })).toContainText(dayLabel(14))

  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Numer indeksu").fill("960002")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("dialog")).toContainText("Piotr Pal")

  await page.getByRole("button", { name: "Pokaż na planszy" }).click()
  await expect(days.getByRole("button", { pressed: true })).toContainText(dayLabel(14))
  const mine = page.getByRole("button", { name: /Twój slot: Piotr Pal/ })
  await expect(mine).toContainText("Twój: Piotr Pal")
  await expect(mine).toHaveClass(/animate-slot-pulse/)
})

test("usunięte w trakcie zaliczenie: komunikat zamiast pustej strony", async ({
  page,
  browser,
}) => {
  const doomedExamId = exams().doomed
  await page.clock.install()
  await page.goto(`/z/${doomedExamId}`)
  await expect(page.getByRole("heading", { name: "Usuwane E2E" })).toBeVisible()

  const admin = await browser.newPage()
  await login(admin)
  await admin.goto(`/zaliczenia/${doomedExamId}`)
  await admin.getByRole("button", { name: "Usuń", exact: true }).first().click()
  await admin.getByLabel("Nazwa zaliczenia").fill("Usuwane E2E")
  await admin.getByRole("button", { name: "Usuń na zawsze" }).click()
  await admin.waitForURL((url) => url.pathname === "/")
  await expect(admin.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()
  await admin.goBack()
  await expect(admin.getByRole("heading", { name: "Nie znaleziono strony" })).toBeVisible()
  await expect(admin.getByRole("link", { name: "Moje zaliczenia" })).toBeVisible()
  await admin.close()

  await page.clock.runFor(31_000)
  await expect(page.getByText("Tego zaliczenia już nie ma")).toBeVisible()
})
