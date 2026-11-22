import { expect, test } from "@playwright/test"

import { login } from "./helpers.ts"

test("przewodnik: przy pierwszym wejściu prowadzi po przykładowym zaliczeniu, zamknięty nie wraca", async ({
  page,
}) => {
  await login(page)
  await page.evaluate(() => localStorage.removeItem("terminus:tour-done"))
  await page.reload()
  const tour = page.locator(".driver-popover")
  await expect(tour).toContainText("Witaj w Terminusie")
  await page.getByRole("button", { name: "Dalej" }).click()
  await expect(tour).toContainText("Nowe zaliczenie")
  await page.getByRole("button", { name: "Dalej" }).click()
  await expect(tour).toContainText("Przykładowe zaliczenie")
  await page.getByRole("button", { name: "Dalej" }).click()

  await expect(tour).toContainText("Karty zaliczenia")
  await expect(page.getByRole("heading", { name: "Przykładowe zaliczenie" })).toBeVisible()
  await expect(page.getByText("2 z 6 zapisanych, wolnych slotów 4")).toBeVisible()
  await page.getByRole("button", { name: "Dalej" }).click()
  await expect(tour).toContainText("Import studentów")
  await expect(page.getByLabel(/Import listy z pliku CSV/)).toBeVisible()
  await page.getByRole("button", { name: "Dalej" }).click()
  await expect(tour).toContainText("Sloty")
  await expect(page).toHaveURL(/tab=sloty/)

  await page.keyboard.press("Escape")
  await expect(tour).toBeHidden()
  await page.goto("/")
  await expect(page.getByRole("link", { name: /Przykładowe zaliczenie/ })).toHaveCount(1)
  await expect(tour).toBeHidden()
})
