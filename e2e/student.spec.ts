import { expect, test } from "@playwright/test"

import { exams } from "./helpers.ts"

test("zapis zespołu, bilet, a ponowne wejście pokazuje ten sam slot", async ({ page }) => {
  await page.goto(`/z/${exams().student}`)
  await expect(page.getByRole("heading", { name: "Kolokwium E2E" })).toBeVisible()

  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("600001")
  await page.getByRole("button", { name: /Dodaj osobę do zespołu \(1\/2\)/ }).click()
  await page.getByLabel("Osoba 2 — numer indeksu").fill("600002")
  await page.getByRole("button", { name: "Losuj slot" }).click()

  await expect(page.getByText("Slot jest przydzielony na stałe.")).toBeVisible()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Ewa Ekiert")
  await expect(dialog).toContainText("600002")
  const time = (await dialog
    .getByText(/^\d{2}:\d{2}/)
    .first()
    .textContent())!.slice(0, 5)

  await page.getByRole("button", { name: "Pokaż na planszy" }).click()
  await expect(page.getByRole("button", { name: "Twój slot", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: new RegExp(`^${time}.*Ewa Ekiert`) })).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("600002")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText(`Masz już zapis`)
  await expect(page.getByRole("alert")).toContainText(time.replace(/^0/, ""))
})

test("indeksu nie ma na liście — komunikat i podświetlone pole", async ({ page }) => {
  await page.goto(`/z/${exams().student}`)
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("123456")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText("Tego indeksu nie ma na liście")
  await expect(page.getByLabel("Osoba 1 — numer indeksu")).toHaveAttribute("aria-invalid", "true")
})

test("brak wolnych slotów: zapisany indeks sprawdza swój slot, niezapisany dostaje komunikat", async ({
  page,
}) => {
  await page.goto(`/z/${exams().full}`)
  await expect(page.getByText("Brak wolnych slotów.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Zapisz się" })).toHaveCount(0)

  await page.getByRole("button", { name: "Sprawdź swój slot" }).click()
  await page.getByLabel("Numer indeksu").fill("700001")
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Masz już zapis")

  await page.getByLabel("Numer indeksu").fill("700002")
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Brak wolnych slotów")
})

test("przed startem zapisów: harmonogram i komunikat z datą, bez przycisku zapisu", async ({
  page,
}) => {
  await page.goto(`/z/${exams().future}`)
  await expect(page.getByRole("status")).toContainText("Zapisy ruszają")
  await expect(page.getByRole("status")).toContainText("12:00")
  await expect(page.getByRole("button", { name: "Zapisz się" })).toHaveCount(0)
  await expect(page.locator("li", { hasText: "09:00" })).toContainText("wolny")
})
