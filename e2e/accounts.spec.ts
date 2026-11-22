import { expect, test, type Page } from "@playwright/test"

import { fillLogin, invite, lastMailLink, login, mailCount } from "./helpers.ts"
import { totpCode } from "./totp.ts"

/** Z zaproszenia w mailu: nadanie hasła, logowanie i połączenie aplikacji z kodami; zwraca adres otpauth. */
async function acceptInvite(page: Page, email: string, password: string) {
  await expect.poll(() => mailCount(email)).toBeGreaterThan(0)
  await page.goto(lastMailLink(email)!)
  await expect(page.getByText(`ustaw hasło do konta ${email}`)).toBeVisible()
  await page.getByLabel("Nowe hasło", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Ustaw hasło" }).click()
  await expect(page.getByText("Hasło ustawione. Zaloguj się.")).toBeVisible()

  await fillLogin(page, email, password)
  await expect(page.getByRole("heading", { name: "Zabezpiecz konto" })).toBeVisible()

  await page.getByRole("button", { name: /Użyj aplikacji z kodami/ }).click()
  await page.getByLabel("Twoje hasło").fill(password)
  await page.getByRole("button", { name: "Dalej" }).click()
  await page.getByText("Nie możesz zeskanować?").click()
  const secret = await page.locator("details code").textContent()
  const totpURI = `otpauth://totp/Terminus?secret=${secret}`
  await page.getByLabel("Kod z aplikacji").fill(await totpCode(totpURI))
  await expect(page.getByText("Kody zapasowe. Każdy działa raz")).toBeVisible()
  await page.getByRole("button", { name: "Zapisałem kody" }).click()
  return totpURI
}

test("superadmin zaprasza, prowadzący nadaje hasło i 2FA, po blokadzie już się nie loguje", async ({
  browser,
  page,
}) => {
  await login(page)
  await invite(page, "Jan Prowadzący", "jan@e2e.test")
  const row = page.locator("li", { hasText: "jan@e2e.test" })
  await expect(row).toContainText("Zaproszone")

  const jan = await (await browser.newContext()).newPage()
  await acceptInvite(jan, "jan@e2e.test", "haslo-jana-123")
  await expect(jan.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()
  await expect(jan.getByText("Nie masz jeszcze żadnego zaliczenia.")).toBeVisible()

  await page.reload()
  await expect(row).toContainText("Aktywne")
  await row.getByRole("button", { name: "Akcje: Jan Prowadzący" }).click()
  await page.getByRole("menuitem", { name: "Zablokuj" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Zablokuj" }).click()
  await expect(row).toContainText("Zablokowane")

  await jan.reload()
  await expect(jan).toHaveURL(/\/login/)
  await fillLogin(jan, "jan@e2e.test", "haslo-jana-123")
  await expect(jan.getByText("To konto jest zablokowane.")).toBeVisible()
})

test("reset 2FA przez superadmina: prowadzący znów trafia na konfigurację", async ({
  browser,
  page,
}) => {
  await login(page)
  await invite(page, "Ewa Reset", "ewa@e2e.test")

  const ewa = await (await browser.newContext()).newPage()
  const totpURI = await acceptInvite(ewa, "ewa@e2e.test", "haslo-ewy-1234")
  await expect(ewa.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Akcje: Ewa Reset" }).click()
  await page.getByRole("menuitem", { name: "Resetuj 2FA" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Resetuj 2FA" }).click()
  await expect(page.locator("li", { hasText: "ewa@e2e.test" })).toContainText("Bez 2FA")

  await ewa.reload()
  await expect(ewa).toHaveURL(/\/login/)
  await fillLogin(ewa, "ewa@e2e.test", "haslo-ewy-1234")
  await expect(ewa.getByRole("heading", { name: "Zabezpiecz konto" })).toBeVisible()
  expect(totpURI).toContain("secret=")
})

test("nieudane wysłanie formularza: błąd ogłoszony, fokus na pierwszym błędnym polu", async ({
  page,
}) => {
  await login(page)
  await page.goto("/konta")
  const form = page.locator("form", { hasText: "Wyślij zaproszenie" })
  await form.getByRole("button", { name: "Wyślij zaproszenie" }).click()
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
