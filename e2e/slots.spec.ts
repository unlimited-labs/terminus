import { expect, test, type Page } from "@playwright/test"

import { exams, login } from "./helpers.ts"

const slot = (page: Page, time: string) => page.locator("li", { hasText: time })

test.beforeEach(async ({ page }) => {
  await login(page)
})

test("usunięcie slotu i wolnych slotów dnia pyta w dialogu", async ({ page }) => {
  await page.goto(`/zaliczenia/${exams().slotsDelete}`)

  await slot(page, "09:20–09:40").getByRole("button", { name: "Usuń" }).click()
  await expect(page.getByRole("dialog", { name: "Usunąć slot?" })).toBeVisible()
  await page.getByRole("button", { name: "Anuluj" }).click()
  await expect(slot(page, "09:20–09:40")).toBeVisible()

  await slot(page, "09:20–09:40").getByRole("button", { name: "Usuń" }).click()
  await page.getByRole("button", { name: "Usuń slot" }).click()
  await expect(slot(page, "09:20–09:40")).toHaveCount(0)

  await page.getByRole("button", { name: "usuń wolne sloty" }).first().click()
  await expect(page.getByRole("dialog", { name: "Usunąć wolne sloty tego dnia?" })).toBeVisible()
  await page.getByRole("button", { name: "Usuń wolne sloty" }).click()
  await expect(
    page.getByText("Usunięto wolne sloty: 1. Pominięto sloty z zapisami: 1."),
  ).toBeVisible()
  await expect(slot(page, "09:00–09:20")).toHaveCount(2)
  await expect(slot(page, "09:40–10:00")).toHaveCount(0)
})

test("nieudane kopiowanie linku pokazuje toast z błędem", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("brak zgody"))
  })
  await page.goto(`/zaliczenia/${exams().slotsAnswers}`)
  await page.getByRole("button", { name: "Kopiuj link" }).click()
  await expect(page.getByText(/Nie udało się skopiować/)).toBeVisible()
})

test("podwójne kliknięcie Zapisz przy odpowiedziach wysyła jedno żądanie", async ({ page }) => {
  await page.goto(`/zaliczenia/${exams().slotsAnswers}/tablica`)
  await page.getByRole("button", { name: "Zmień odpowiedzi zespołu" }).click()
  await page.getByLabel("Temat").fill("Dron")

  let posts = 0
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/_serverFn/")) posts++
  })
  await page.getByRole("button", { name: "Zapisz" }).dblclick()
  await expect(page.getByText("Zapisano odpowiedzi zespołu.")).toBeVisible()
  await expect(page.getByText("Temat: Dron")).toBeVisible()
  expect(posts).toBe(1)
})

test("edycja slotu: nowa godzina, kolizja zostawia formularz, Anuluj zamyka", async ({ page }) => {
  await page.goto(`/zaliczenia/${exams().slotsEdit}`)
  const edit = page.locator("li form")

  await slot(page, "09:00–09:20").getByRole("button", { name: "Edytuj" }).click()
  await edit.getByLabel("Od").fill("08:30")
  await edit.getByLabel("Do").fill("08:50")
  await edit.getByRole("button", { name: "Zapisz" }).click()
  await expect(edit).toHaveCount(0)
  await expect(slot(page, "08:30–08:50")).toBeVisible()
  await expect(slot(page, "09:00–09:20")).toHaveCount(0)

  await slot(page, "08:30–08:50").getByRole("button", { name: "Edytuj" }).click()
  await edit.getByLabel("Od").fill("09:10")
  await edit.getByLabel("Do").fill("09:30")
  await edit.getByRole("button", { name: "Zapisz" }).click()
  await expect(page.getByText(/^Koliduje z istniejącym slotem .*09:20–09:40\.$/)).toBeVisible()
  await expect(edit).toBeVisible()

  await edit.getByRole("button", { name: "Anuluj" }).click()
  await expect(edit).toHaveCount(0)
  await expect(slot(page, "08:30–08:50")).toBeVisible()
})
