import { expect, test } from "@playwright/test"

import { exams, login } from "./helpers.ts"

test.beforeEach(async ({ page }) => {
  await login(page)
})

test("zły identyfikator zaliczenia to 404, nie błąd", async ({ page }) => {
  await page.goto("/zaliczenia/abc")
  await expect(page.getByRole("heading", { name: "Nie znaleziono strony" })).toBeVisible()
})

test("wygasła sesja przy przejściu do zaliczenia prowadzi do logowania z powrotem", async ({
  page,
}) => {
  await page.goto("/")
  await page.context().clearCookies()
  await page.getByText("Tablica E2E").first().click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible()
})

test("błąd wczytania pokazuje stronę błędu, a ponowienie wczytuje dane", async ({ page }) => {
  await page.goto("/")
  await page.route(/_serverFn/, (route) => route.abort())
  await page.evaluate(
    (id) => window.history.pushState({}, "", `/zaliczenia/${id}`),
    exams().exportDuplicate,
  )
  await page.goBack()
  await page.goForward()
  await expect(page.getByRole("heading", { name: "Coś poszło nie tak" })).toBeVisible()

  await page.unroute(/_serverFn/)
  await page.getByRole("button", { name: "Spróbuj ponownie" }).click()
  await expect(page.getByRole("heading", { name: "Tablica E2E" })).toBeVisible()
})
