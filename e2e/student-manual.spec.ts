import { expect, test } from "@playwright/test"

import { exams, login } from "./helpers.ts"

test("ręczny przydział: klik w wolny slot, zapis, bilet z wybraną godziną", async ({ page }) => {
  await page.goto(`/z/${exams().manual}`)
  await expect(page.getByRole("heading", { name: "Ręczny E2E" })).toBeVisible()

  await page.getByRole("button", { name: /^09:20.*wolny/ }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Wybrany slot")
  await dialog.getByLabel("Numer indeksu").fill("990001")
  await dialog.getByRole("button", { name: /^Zapisz się na/ }).click()

  await expect(dialog).toContainText("Alicja Arbuz")
  await expect(dialog.getByText(/^09:20/).first()).toBeVisible()
})

test("prowadzący zmienia sposób przy otwartej stronie: dane zostają, strona przechodzi na wybór", async ({
  page,
  browser,
}) => {
  await page.goto(`/z/${exams().modeSwitch}`)
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Numer indeksu").fill("990002")

  const admin = await browser.newPage()
  await login(admin)
  await admin.goto(`/zaliczenia/${exams().modeSwitch}`)
  await admin.getByRole("tab", { name: "Ustawienia" }).click()
  await admin.getByRole("button", { name: "Ręczny" }).click()
  await admin.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(admin.getByText("Zapisano zmiany.")).toBeVisible()
  await admin.close()

  await page.getByRole("button", { name: "Losuj slot" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Prowadzący zmienił sposób zapisu na ręczny")
  await expect(dialog.getByLabel("Numer indeksu")).toHaveValue("990002")
  await expect(dialog).toContainText("Nie wybrano slotu")
  await expect(dialog.getByRole("button", { name: "Wybierz slot" })).toBeDisabled()
})
