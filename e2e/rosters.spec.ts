import { expect, test } from "@playwright/test"

import { day, exams, login } from "./helpers.ts"

const FIXTURE = "src/domain/fixtures/studenci_110-ITE-2S-027_g1_2026-09-30.csv"

test("import CSV z podglądem, druga lista i okno slotów dla wybranej listy", async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().rosters}`)

  await page.getByLabel(/Import listy z pliku CSV/).setInputFiles(FIXTURE)
  await expect(page.getByLabel("Nazwa listy")).toHaveValue("g1")
  await expect(page.getByText("Ponowny import do istniejącej listy.")).toBeVisible()
  await expect(page.getByText("wiersz 6: 40A005 — indeks nie z samych cyfr")).toBeVisible()
  await page.getByRole("button", { name: "Zapisz listę" }).click()
  await expect(page.getByText("Zaimportowano listę.")).toBeVisible()
  await expect(page.getByRole("cell", { name: "400001" })).toBeVisible()

  await page.getByLabel(/Import listy z pliku CSV/).setInputFiles(FIXTURE)
  await page.getByLabel("Nazwa listy").fill("g2")
  await page.getByLabel("Nazwa listy").press("Enter")
  await expect(page.getByText("Nowa lista.")).toBeVisible()
  await page.getByRole("button", { name: "Zapisz listę" }).click()
  await expect(page.getByText("Listy indeksów")).toBeVisible()

  const windowForm = page.locator("form", { hasText: "Dodaj okno" })
  await windowForm.getByLabel("Data").fill(day(7))
  await windowForm.getByLabel("Od").fill("12:00")
  await windowForm.getByLabel("Do").fill("12:40")
  await windowForm.getByLabel("Lista").click()
  await page.getByRole("option", { name: "g2" }).click()
  await windowForm.getByRole("button", { name: "Dodaj sloty" }).click()
  await expect(page.getByText("Dodano sloty: 2.")).toBeVisible()
})

test("ponowny import: skreślony z zapisem widoczny w podglądzie ze slotem, potem znika razem z zapisem", async ({
  page,
}) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().withdrawn}`)
  await page.getByLabel(/Import listy z pliku CSV/).setInputFiles(FIXTURE)
  await expect(page.getByText("Ponowny import do istniejącej listy.")).toBeVisible()
  await expect(page.getByText(/^400003 Zając Ewa — slot .*10:00/)).toBeVisible()

  await page.getByRole("button", { name: "Zapisz listę" }).click()
  await expect(page.getByText("Zaimportowano listę.")).toBeVisible()
  await expect(page.getByRole("cell", { name: "400003" })).toHaveCount(0)
  await expect(page.getByRole("cell", { name: "400001" })).toBeVisible()
})
