import { expect, test } from "@playwright/test"

import { dragWithKeyboard, dragWithMouse, exams, login, openBoard } from "./helpers.ts"

test.beforeEach(async ({ page }) => {
  await login(page)
})

const row = (page: import("@playwright/test").Page, time: string) =>
  page.locator("tr", { hasText: time })
const pool = (page: import("@playwright/test").Page) =>
  page.getByRole("complementary", { name: "Niezapisani" })

test("myszą: ręczny zapis z Niezapisanych, Cofnij, zamiana osób", async ({ page }) => {
  await openBoard(page, exams().boardMouse)
  await dragWithMouse(page, pool(page).getByText("500003"), row(page, "09:40–10:00"))
  await expect(page.getByText("Zapisano ręcznie.")).toBeVisible()
  await expect(row(page, "09:40–10:00")).toContainText("Celina Cis")

  await page.getByRole("button", { name: "Cofnij" }).click()
  await expect(pool(page).getByText("500003")).toBeVisible()
  await expect(row(page, "09:40–10:00")).toContainText("wolny")

  await dragWithMouse(page, page.getByText("Anna Adamska"), page.getByText("Bartosz Bąk"))
  await expect(page.getByText("Zamieniono sloty dwóch osób.")).toBeVisible()
  await expect(row(page, "09:20–09:40")).toContainText("Anna Adamska")
  await expect(row(page, "09:00–09:20")).toContainText("Bartosz Bąk")

  await page.reload()
  await expect(row(page, "09:20–09:40")).toContainText("Anna Adamska")
})

test("klawiaturą: przeniesienie osoby do wolnego slotu", async ({ page }) => {
  await openBoard(page, exams().boardKeyboard)
  const tile = page.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await dragWithKeyboard(page, tile, row(page, "09:40–10:00"))
  await expect(page.getByText("Przeniesiono.")).toBeVisible()
  await expect(row(page, "09:40–10:00")).toContainText("Bartosz Bąk")
  await expect(page.getByText(/^Upuszczono Bartosz Bąk/)).toBeAttached()
  await expect(page.getByText(/^Aby podnieść, naciśnij spację/)).toBeAttached()
})

test("myszą: cały zespół uchwytem na wolny slot", async ({ page }) => {
  await openBoard(page, exams().boardTeam)
  const handle = row(page, "09:20–09:40").getByRole("button", { name: /Przenieś cały zespół/ })
  await dragWithMouse(page, handle, row(page, "09:00–09:20"))
  await expect(page.getByText("Przeniesiono zespół.")).toBeVisible()
  await expect(page.locator("[data-dnd-placeholder]")).toHaveCount(0)
  await expect(row(page, "09:20–09:40")).toContainText("wolny")
  await expect(row(page, "09:00–09:20")).toContainText("Anna Adamska")
})

test("za długie nazwisko: komunikat z limitem, formularz zostaje otwarty", async ({ page }) => {
  await openBoard(page, exams().boardKeyboard)
  await page
    .getByRole("button", { name: "Zmień imię i nazwisko: Bartosz Bąk", exact: true })
    .click()
  await page.getByLabel("Nazwisko", { exact: true }).fill("x".repeat(101))
  await page.getByRole("button", { name: "Zapisz" }).click()
  await expect(page.getByText("Najwyżej 100 znaków.")).toBeVisible()
  await expect(page.getByLabel("Nazwisko", { exact: true })).toBeVisible()
  await expect(page.getByText("Coś poszło nie tak")).toHaveCount(0)
})

test("ocena w okienku, cały zespół, Cofnij, potwierdzenie usunięcia zapisu z oceną", async ({
  page,
}) => {
  await openBoard(page, exams().boardGrades)
  const counter = page.getByText(/ocenieni \d+ \/ \d+/)
  // Toasty leżą w stosie; klikalny jest tylko najnowszy (z przodu).
  const undo = () =>
    page.locator("[data-sonner-toast][data-front=true]").getByRole("button", { name: "Cofnij" })
  const chip = (name: string) => page.getByRole("button", { name: `Ocena: ${name}`, exact: true })
  await expect(counter).toContainText("ocenieni 0 / 2")

  await chip("Anna Adamska").click()
  await page.getByRole("button", { name: "4", exact: true }).click()
  await expect(page.getByText("Zapisano ocenę.")).toBeVisible()
  await page.getByLabel("Komentarz (opcjonalny)").fill("dobra prezentacja")
  await page.getByRole("button", { name: "Ta sama ocena dla całego zespołu (2)" }).click()
  await expect(chip("Bartosz Bąk")).toHaveText("4")
  await expect(counter).toContainText("ocenieni 2 / 2")
  await expect(page.getByText("Zapisano ocenę.")).toHaveCount(3)
  await page.keyboard.press("Escape")

  await undo().press("Enter")
  await expect(chip("Bartosz Bąk")).toHaveText("ocena")
  await expect(counter).toContainText("ocenieni 1 / 2")

  await page.reload()
  await expect(chip("Anna Adamska")).toHaveText("4")
  await chip("Anna Adamska").click()
  await expect(page.getByLabel("Komentarz (opcjonalny)")).toHaveValue("dobra prezentacja")
  await expect(page.getByText(/^Admin E2E, /)).toBeVisible()
  await page.keyboard.press("Escape")

  const remove = page.getByRole("button", { name: "Usuń zapis: Anna Adamska", exact: true })
  await remove.click()
  await expect(page.getByRole("dialog", { name: "Usunąć zapis z oceną?" })).toContainText(
    "Anna Adamska (500001): 4",
  )
  await page.getByRole("button", { name: "Anuluj" }).click()
  await expect(row(page, "09:00–09:20")).toContainText("Anna Adamska")

  await remove.click()
  await page.getByRole("button", { name: "Usuń zapis i ocenę" }).click()
  await expect(pool(page).getByText("500001")).toBeVisible()
  await expect(page.getByText("Usunięto zapis.")).toBeVisible()
  await expect(counter).toContainText("ocenieni 0 / 1")
  await undo().press("Enter")
  await expect(chip("Anna Adamska")).toHaveText("4")
})
