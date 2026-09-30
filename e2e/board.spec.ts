import { expect, test } from "@playwright/test"

import { dragWithKeyboard, dragWithMouse, login, state } from "./helpers.ts"

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${state().boardExamId}/tablica`)
  await expect(page.getByRole("heading", { name: /tablica zapisów/ })).toBeVisible()
})

const row = (page: import("@playwright/test").Page, time: string) =>
  page.locator("tr", { hasText: time })
const pool = (page: import("@playwright/test").Page) =>
  page.getByRole("complementary", { name: "Niezapisani" })

test("myszą: ręczny zapis z Niezapisanych, Cofnij, zamiana osób", async ({ page }) => {
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
  const tile = page.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await dragWithKeyboard(page, tile, row(page, "09:40–10:00"))
  await expect(page.getByText("Przeniesiono.")).toBeVisible()
  await expect(row(page, "09:40–10:00")).toContainText("Bartosz Bąk")
  await expect(page.getByText(/^Upuszczono Bartosz Bąk/)).toBeAttached()
  await expect(page.getByText(/^Aby podnieść, naciśnij spację/)).toBeAttached()
})

test("myszą: cały zespół uchwytem na wolny slot (po poprzednich testach: Anna 9:20, 9:00 wolny)", async ({
  page,
}) => {
  const handle = row(page, "09:20–09:40").getByRole("button", { name: /Przenieś cały zespół/ })
  await dragWithMouse(page, handle, row(page, "09:00–09:20"))
  await expect(page.getByText("Przeniesiono zespół.")).toBeVisible()
  await expect(page.locator("[data-dnd-placeholder]")).toHaveCount(0)
  await expect(row(page, "09:20–09:40")).toContainText("wolny")
  await expect(row(page, "09:00–09:20")).toContainText("Anna Adamska")
})
