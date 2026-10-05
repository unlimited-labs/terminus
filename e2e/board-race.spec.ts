import { expect, test, type Page } from "@playwright/test"

import { dragWithMouse, login, state } from "./helpers.ts"

const row = (page: Page, time: string) => page.locator("tr", { hasText: time })
const pool = (page: Page) => page.getByRole("complementary", { name: "Niezapisani" })

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto(`/zaliczenia/${state().raceExamId}/tablica`)
  await expect(page.getByRole("heading", { name: /tablica zapisów/ })).toBeVisible()
})

test("zmiana nazwy: przycisk Zapisz, fokus wraca na ołówek; Enter na ołówku nie podnosi kafelka", async ({
  page,
}) => {
  const pencil = page.getByRole("button", { name: "Zmień imię i nazwisko: Marek Mak", exact: true })
  await pencil.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByLabel("Imię")).toBeFocused()
  await expect(page.getByText(/^Podniesiono/)).toHaveCount(0)

  await page.getByLabel("Nazwisko", { exact: true }).fill("Makowski")
  await page.getByRole("button", { name: "Zapisz" }).click()
  await expect(page.getByText("Zmieniono imię i nazwisko.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Zmień imię i nazwisko: Marek Makowski", exact: true }),
  ).toBeFocused()
})

test("dwa szybkie przeciągnięcia, pierwsze odrzucone przez serwer: tablica zgodna z serwerem; ogłoszenie z dniem", async ({
  page,
  browser,
}) => {
  const held = Promise.withResolvers<void>()
  let first = true
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "POST" || !first) return route.continue()
    first = false
    await held.promise
    await route.continue()
  })

  await dragWithMouse(page, pool(page).getByText("900001"), row(page, "09:00–09:20"))
  await expect(row(page, "09:00–09:20")).toContainText("Kamil Kos")
  await expect(page.locator("[data-dnd-placeholder]")).toHaveCount(0)
  const marek = page.locator("[aria-roledescription]", { hasText: "Marek Makowski" })
  await dragWithMouse(page, marek, row(page, "09:20–09:40"))
  await expect(page.getByRole("status")).toHaveText(/na: slot \S+ 9\.10 09:20\.$/)

  const other = await browser.newPage()
  await login(other)
  await other.goto(`/zaliczenia/${state().raceExamId}/tablica`)
  await dragWithMouse(other, pool(other).getByText("900002"), row(other, "09:00–09:20"))
  await expect(other.getByText("Zapisano ręcznie.")).toBeVisible()
  await other.close()
  held.resolve()

  await expect(page.getByText("Slot jest pełny.")).toBeVisible()
  await expect(page.getByText("Przeniesiono.")).toBeVisible()
  await expect(row(page, "09:00–09:20")).toContainText("Lena Lis")
  await expect(row(page, "09:20–09:40")).toContainText("Marek Makowski")
  await expect(row(page, "09:40–10:00")).toContainText("wolny")
  await expect(pool(page).getByText("900001")).toBeVisible()
  const shown = await page.locator("table").innerText()
  await page.reload()
  await expect(row(page, "09:00–09:20")).toContainText("Lena Lis")
  expect(await page.locator("table").innerText()).toBe(shown)
})
