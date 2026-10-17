import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

import { exams, login } from "./helpers.ts"

test("dodatkowe pole: prowadzący dodaje, zespół wypełnia przy zapisie, widać na bilecie, tablicy i w eksporcie", async ({
  page,
}) => {
  const boardExamId = exams().fields
  await login(page)
  await page.goto(`/zaliczenia/${boardExamId}`)
  await page.getByRole("tab", { name: "Ustawienia" }).click()
  await page.getByRole("button", { name: "Dodaj pole" }).click()
  await page.getByLabel("Pole 1 — nazwa (np. Tytuł projektu)").fill("Tytuł projektu")
  await page.getByRole("checkbox", { name: "wymagane" }).check()
  await page.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(page.getByText("Zapisano zmiany.")).toBeVisible()

  await page.goto(`/z/${boardExamId}`)
  await page.getByRole("button", { name: "Zapisz się" }).click()
  await page.getByLabel("Osoba 1 — numer indeksu").fill("500003")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("alert")).toContainText("Uzupełnij: Tytuł projektu.")
  await page.getByLabel("Tytuł projektu").fill("Robot sprzątający")
  await page.getByRole("button", { name: "Losuj slot" }).click()
  await expect(page.getByRole("dialog")).toContainText("Tytuł projektu: Robot sprzątający")

  await page.goto(`/zaliczenia/${boardExamId}/tablica`)
  await expect(page.getByText("Tytuł projektu: Robot sprzątający")).toBeVisible()

  await page.goto(`/zaliczenia/${boardExamId}`)
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Eksport CSV" }).click(),
  ])
  const csv = readFileSync(await download.path(), "utf8")
  expect(csv).toContain('"imie";"ocena";"komentarz";"Tytuł projektu"')
  expect(csv).toContain('"500003";"Cis";"Celina";"Robot sprzątający"')
})
