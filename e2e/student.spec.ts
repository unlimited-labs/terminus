import { expect, test } from "@playwright/test"

import { state } from "./helpers.ts"

test("zapis zespołu, bilet, a ponowne wejście pokazuje ten sam slot", async ({ page }) => {
  await page.goto(`/z/${state().studentExamId}`)
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
  await expect(page.getByRole("button", { name: "Twój slot" })).toBeVisible()
  await expect(page.getByRole("button", { name: new RegExp(`${time}.*Ekiert \\+1`) })).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("600002")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText(`Masz już zapis`)
  await expect(page.getByRole("alert")).toContainText(time.replace(/^0/, ""))
})

test("indeksu nie ma na liście — komunikat i podświetlone pole", async ({ page }) => {
  await page.goto(`/z/${state().studentExamId}`)
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("123456")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText("Tego indeksu nie ma na liście")
  await expect(page.getByLabel("Osoba 1 — numer indeksu")).toHaveAttribute("aria-invalid", "true")
})
