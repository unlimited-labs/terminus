import { expect, test, type Page } from "@playwright/test"

import { exams, lastMailLink, login, mailCount } from "./helpers.ts"

// Wszystkie prośby o link idą z jednego IP (limit 10 na godzinę), więc testy zużywają ich razem najwyżej 7.

/** Prosi o link z okna logowania zaliczenia (strona `/z/…` bez sesji). */
async function requestLink(page: Page, index: string) {
  await page.getByLabel("Numer albumu").fill(index)
  await page.getByRole("button", { name: "Wyślij link" }).click()
}

/** Czeka na nowy mail do adresu (liczy od `before`) i zwraca jego link. */
async function newLink(address: string, before: number) {
  await expect.poll(() => mailCount(address)).toBeGreaterThan(before)
  return lastMailLink(address)!
}

test("brama bez sesji, link w mailu, „Wejdź”, ten sam link drugi raz wygasa", async ({ page }) => {
  await page.goto(`/z/${exams().emailLogin}`)
  await expect(page.getByRole("heading", { name: "Logowanie mailem E2E" })).toBeVisible()
  await expect(page.getByText("Zaloguj się, żeby zobaczyć harmonogram.")).toBeVisible()
  await expect(page.getByText("Sala 1.23")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Zapisz się" })).toHaveCount(0)

  const before = mailCount("ola@e2e.test")
  await page.getByRole("button", { name: "Zaloguj się mailem" }).click()
  await requestLink(page, "710001")
  await expect(page.getByText("Jeśli numer 710001 jest na liście")).toBeVisible()
  const link = await newLink("ola@e2e.test", before)

  await page.goto(link)
  await expect(page.getByRole("heading", { name: "Wejdź na listę zapisów" })).toBeVisible()
  await page.getByRole("button", { name: "Wejdź" }).click()
  await expect(page.getByRole("button", { name: "Zapisz się" })).toBeVisible()
  await expect(page.getByText("710001", { exact: true })).toBeVisible()

  await page.goto(link)
  await page.getByRole("button", { name: "Wejdź" }).click()
  await expect(page.getByText("Link wygasł lub został użyty.")).toBeVisible()
})

test("numer spoza listy: ten sam ekran, bez maila", async ({ page }) => {
  await page.goto(`/z/${exams().emailLogin}`)
  const before = ["ola", "piotr", "zofia"].map((name) => mailCount(`${name}@e2e.test`))
  await page.getByRole("button", { name: "Zaloguj się mailem" }).click()
  await requestLink(page, "999999")
  await expect(page.getByText("Jeśli numer 999999 jest na liście")).toBeVisible()
  await page.waitForTimeout(1000)
  expect(["ola", "piotr", "zofia"].map((name) => mailCount(`${name}@e2e.test`))).toEqual(before)
})

test("czwarta prośba o ten sam indeks w godzinę: ten sam ekran, bez czwartego maila", async ({
  page,
}) => {
  await page.goto(`/z/${exams().emailLogin}`)
  const before = mailCount("zofia@e2e.test")
  await page.getByRole("button", { name: "Zaloguj się mailem" }).click()
  for (let i = 0; i < 4; i++) {
    await requestLink(page, "710003")
    await expect(page.getByText("Jeśli numer 710003 jest na liście")).toBeVisible()
    await page.getByRole("button", { name: "Zmień numer" }).click()
  }
  await expect.poll(() => mailCount("zofia@e2e.test")).toBe(before + 3)
  await page.waitForTimeout(1000)
  expect(mailCount("zofia@e2e.test")).toBe(before + 3)
})

test("zapis z sesją; zespół bez własnego indeksu jest odrzucony", async ({ page }) => {
  await page.goto(`/z/${exams().emailLogin}`)
  const before = mailCount("piotr@e2e.test")
  await page.getByRole("button", { name: "Zaloguj się mailem" }).click()
  await requestLink(page, "710002")
  await page.goto(await newLink("piotr@e2e.test", before))
  await page.getByRole("button", { name: "Wejdź" }).click()

  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("710001")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText("Zapisu dokonuje się z własnego indeksu")

  await page.getByLabel("Osoba 1 — numer indeksu").fill("710002")
  await page.getByRole("button", { name: /Dodaj osobę do zespołu/ }).click()
  await page.getByLabel("Osoba 2 — numer indeksu").fill("710001")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByText("Slot jest przydzielony na stałe.")).toBeVisible()
  await expect(page.getByRole("dialog")).toContainText("Ola Ach")
})

test("prowadzący włącza opcję i strona zapisów zamyka się za logowaniem", async ({
  page,
  browser,
}) => {
  const id = exams().emailLoginSetup
  await login(page)
  await page.goto(`/zaliczenia/${id}`)
  await page.getByRole("tab", { name: "Ustawienia" }).click()
  await page.getByRole("checkbox", { name: "Wymagaj logowania mailem" }).check()
  await page.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(page.getByText("Zapisano zmiany.")).toBeVisible()

  const student = await browser.newPage()
  await student.goto(`/z/${id}`)
  await expect(student.getByText("Zaloguj się, żeby zobaczyć harmonogram.")).toBeVisible()
  await student.close()
})
