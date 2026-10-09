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
  await expect(page.getByRole("checkbox", { name: "Kopiuj listy indeksów" })).toBeChecked()
  await page.getByRole("button", { name: "Utwórz kopię" }).click()
  await expect(page.getByRole("heading", { name: "Tablica E2E (kopia)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Sloty (0)" })).toBeVisible()
  await page.getByRole("tab", { name: /Lista indeksów/ }).click()
  await expect(page.getByRole("cell", { name: "500003" })).toBeVisible()
})

test("zmiana nazwy zaliczenia widoczna na liście bez przeładowania", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("Stara nazwa E2E")).toBeVisible()
  await page.getByText("Stara nazwa E2E").click()
  await page.getByRole("tab", { name: "Ustawienia" }).click()
  await page.getByLabel("Nazwa (z nazwą przedmiotu)").fill("Nowa nazwa E2E")
  await page.getByRole("button", { name: "Zapisz", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Nowa nazwa E2E" })).toBeVisible()
  await page.getByRole("link", { name: "Moje zaliczenia" }).click()
  await expect(page.getByText("Nowa nazwa E2E")).toBeVisible()
})
