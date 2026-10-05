import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

import { exams, login } from "./helpers.ts"

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().exportDuplicate}`)
})

test("eksport CSV: UTF-8 z BOM, ; i nazwa z datą", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Eksport CSV" }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^Tablica E2E_\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = readFileSync(await download.path(), "utf8")
  expect(csv.startsWith('﻿"data";"od";"do";"lista";"indeks";"nazwisko";"imie"')).toBe(true)
  expect(csv).toContain('"500001";"Adamska";"Anna"')
})

test("duplikat z listami prowadzi do nowego zaliczenia", async ({ page }) => {
  await page.getByRole("button", { name: "Duplikuj" }).click()
  await expect(page.getByLabel("Kopiuj listy indeksów")).toBeChecked()
  await page.getByRole("button", { name: "Utwórz kopię" }).click()
  await expect(page.getByRole("heading", { name: "Tablica E2E (kopia)" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "500003" })).toBeVisible()
  await expect(page.getByText("Sloty (0)")).toBeVisible()
})
