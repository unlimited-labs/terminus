import { expect, test } from "@playwright/test"

import { login } from "./helpers.ts"

test("superadmin zakłada konto, prowadzący się loguje, po blokadzie już nie", async ({
  browser,
  page,
}) => {
  await login(page)
  await page.goto("/konta")
  const form = page.locator("form", { hasText: "Utwórz konto" })
  await form.getByLabel("Imię i nazwisko").fill("Jan Prowadzący")
  await form.getByLabel("E-mail").fill("jan@e2e.test")
  await form.getByLabel("Hasło").fill("haslo-jana-123")
  await form.getByRole("button", { name: "Utwórz konto" }).click()
  await expect(page.getByText("jan@e2e.test")).toBeVisible()

  const jan = await (await browser.newContext()).newPage()
  await login(jan, "jan@e2e.test", "haslo-jana-123")
  await expect(jan.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()
  await expect(jan.getByText("Nie masz jeszcze żadnego zaliczenia.")).toBeVisible()

  await page
    .locator("li", { hasText: "jan@e2e.test" })
    .getByRole("button", { name: "Zablokuj" })
    .click()
  await expect(page.locator("li", { hasText: "jan@e2e.test" })).toContainText("zablokowane")

  await jan.reload()
  await expect(jan).toHaveURL(/\/login/)
  await jan.getByLabel("E-mail").fill("jan@e2e.test")
  await jan.getByLabel("Hasło").fill("haslo-jana-123")
  await jan.getByRole("button", { name: "Zaloguj się" }).click()
  await expect(jan.getByText("To konto jest zablokowane.")).toBeVisible()
})

test("nieudane wysłanie formularza: błąd ogłoszony, fokus na pierwszym błędnym polu", async ({
  page,
}) => {
  await login(page)
  await page.goto("/konta")
  const form = page.locator("form", { hasText: "Utwórz konto" })
  await form.getByRole("button", { name: "Utwórz konto" }).click()
  await expect(form.getByLabel("Imię i nazwisko")).toBeFocused()
  await expect(form.getByLabel("Imię i nazwisko")).toHaveAccessibleDescription(
    "Podaj imię i nazwisko.",
  )
  await form.getByLabel("Imię i nazwisko").fill("Jan Nowak")
  await expect(form.getByLabel("Imię i nazwisko")).not.toHaveAttribute("aria-invalid")
  await expect(form.getByText("Podaj imię i nazwisko.")).toHaveCount(0)
})

test("superadmin usuwa zaliczenie zablokowanego prowadzącego", async ({ page }) => {
  await login(page)
  await page.goto("/konta")
  const row = page.locator("li", { hasText: "zablokowany@e2e.test" })
  const exams = row.getByRole("list", { name: "Zaliczenia zablokowanego konta" })
  await expect(exams).toContainText("Zablokowane E2E")
  await expect(exams).toContainText("zapisy: 1")

  await exams.getByRole("button", { name: "Usuń" }).click()
  await page.getByLabel("Nazwa zaliczenia").fill("Zablokowane E2E")
  await page.getByRole("button", { name: "Usuń na zawsze" }).click()
  await expect(row).toContainText("Brak zaliczeń tego konta.")
})
