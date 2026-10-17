import { expect, test } from "@playwright/test"

import { day, exams, login } from "./helpers.ts"

const FIXTURE = "src/domain/fixtures/studenci_110-ITE-2S-027_g1_2026-09-30.csv"

test("import CSV z podglądem, druga lista i okno slotów dla wybranej listy", async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().rosters}?tab=lista`)

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

  await page.getByRole("tab", { name: /Sloty/ }).click()

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
  await page.goto(`/zaliczenia/${exams().withdrawn}?tab=lista`)
  await page.getByLabel(/Import listy z pliku CSV/).setInputFiles(FIXTURE)
  await expect(page.getByText("Ponowny import do istniejącej listy.")).toBeVisible()
  await expect(page.getByText(/^400003 Zając Ewa — slot .*10:00/)).toBeVisible()

  await page.getByRole("button", { name: "Zapisz listę" }).click()
  await expect(page.getByText("Zaimportowano listę.")).toBeVisible()
  await expect(page.getByRole("cell", { name: "400003" })).toHaveCount(0)
  await expect(page.getByRole("cell", { name: "400001" })).toBeVisible()
})

test("dodanie osoby do wybranej listy czyści formularz", async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().rosterAdd}?tab=lista`)
  const form = page.locator("form", { hasText: "Dodaj osobę" })
  await form.getByLabel("Indeks").fill("980010")
  await form.getByLabel("Imię").fill("Urszula")
  await form.getByLabel("Nazwisko").fill("Ul")
  await form.getByLabel("Lista").click()
  await page.getByRole("option", { name: "g2" }).click()
  await form.getByRole("button", { name: "Dodaj osobę" }).click()

  await expect(page.getByText("Dodano osobę do listy.")).toBeVisible()
  await expect(page.getByRole("row", { name: /980010 Ul Urszula .* g2/ })).toBeVisible()
  await expect(form.getByLabel("Indeks")).toHaveValue("")
  await expect(form.getByLabel("Imię")).toHaveValue("")
  await expect(form.getByLabel("Nazwisko")).toHaveValue("")
})

test("usuwanie osób i list: osoba i lista z zapisem zostają", async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().rosterDelete}?tab=lista`)
  const row = (studentNumber: string) => page.getByRole("row", { name: new RegExp(studentNumber) })

  await expect(row("980001").getByRole("button", { name: "Usuń" })).toBeDisabled()
  await row("980002").getByRole("button", { name: "Usuń" }).click()
  await expect(row("980002")).toHaveCount(0)

  const chip = (name: string) => page.locator("li", { hasText: name })
  await chip("g2").getByRole("button", { name: "Usuń listę" }).click()
  await expect(page.getByRole("dialog", { name: "Usunąć listę g2?" })).toBeVisible()
  await page.getByRole("button", { name: "Anuluj" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(row("980003")).toBeVisible()

  await chip("g1").getByRole("button", { name: "Usuń listę" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Usuń listę" }).click()
  await expect(
    page.getByText("Na liście są indeksy z zapisem — najpierw przenieś albo usuń ich zapisy."),
  ).toBeVisible()
  await expect(row("980001")).toBeVisible()

  await chip("g2").getByRole("button", { name: "Usuń listę" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Usuń listę" }).click()
  await expect(row("980003")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Usuń listę" })).toHaveCount(0)
})
