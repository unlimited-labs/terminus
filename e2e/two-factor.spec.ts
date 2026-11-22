import { expect, test, type Page } from "@playwright/test"

import { fillLogin, invite, lastMailLink, login, mailCount } from "./helpers.ts"

/** Wirtualny authenticator Chromium: klucz zapisany na „urządzeniu”, PIN/biometria potwierdzone. */
async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("WebAuthn.enable")
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

test("klucz dostępu: konfiguracja z zaproszenia, logowanie kluczem, hasło już nie wpuszcza", async ({
  browser,
  page,
}) => {
  await login(page)
  await invite(page, "Ola Klucz", "klucz@e2e.test")

  const ola = await (await browser.newContext()).newPage()
  await virtualAuthenticator(ola)
  await expect.poll(() => mailCount("klucz@e2e.test")).toBe(1)
  await ola.goto(lastMailLink("klucz@e2e.test")!)
  await ola.getByLabel("Nowe hasło", { exact: true }).fill("haslo-klucza-12")
  await ola.getByRole("button", { name: "Ustaw hasło" }).click()
  await fillLogin(ola, "klucz@e2e.test", "haslo-klucza-12")

  await ola.getByRole("button", { name: "Dodaj klucz dostępu" }).click()
  await expect(ola.getByText("Klucz dostępu dodany.")).toBeVisible()
  await ola.getByRole("button", { name: "Przejdź do zaliczeń" }).click()
  await expect(ola.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()

  await ola.getByRole("button", { name: "Ola Klucz" }).click()
  await ola.getByRole("menuitem", { name: "Wyloguj" }).click()
  await expect(ola).toHaveURL(/\/login/)
  await fillLogin(ola, "klucz@e2e.test", "haslo-klucza-12")
  await expect(ola.getByText("To konto loguje się kluczem dostępu.")).toBeVisible()

  await ola.getByRole("button", { name: "Zaloguj kluczem dostępu" }).click()
  await expect(ola.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()

  await ola.getByRole("button", { name: "Ola Klucz" }).click()
  await ola.getByRole("menuitem", { name: "Weryfikacja dwuetapowa" }).click()
  await expect(ola.getByText("To Twój jedyny sposób potwierdzania logowania.")).toBeVisible()
  await expect(ola.getByRole("button", { name: "Usuń" })).toBeDisabled()
})

test("„Nie pamiętam hasła”: ta sama odpowiedź dla nieznanego adresu, link dla konta", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("link", { name: "Nie pamiętam hasła" }).click()
  await expect(page.getByRole("button", { name: "Wyślij link" })).toBeVisible()
  await page.getByLabel("E-mail").fill("nieznany@e2e.test")
  await page.getByRole("button", { name: "Wyślij link" }).click()
  await expect(page.getByText("Jeśli to adres konta prowadzącego")).toBeVisible()
  expect(mailCount("nieznany@e2e.test")).toBe(0)

  await page.reload()
  await page.getByLabel("E-mail").fill("admin@e2e.test")
  await page.getByRole("button", { name: "Wyślij link" }).click()
  await expect(page.getByText("Jeśli to adres konta prowadzącego")).toBeVisible()
  await expect.poll(() => mailCount("admin@e2e.test")).toBe(1)

  await page.goto(lastMailLink("admin@e2e.test")!)
  await expect(page.getByText("Nowe hasło do konta admin@e2e.test.")).toBeVisible()
  await page.goto("/nowe-haslo?token=zly")
  await expect(page.getByText("Link wygasł albo został już użyty.")).toBeVisible()
})
