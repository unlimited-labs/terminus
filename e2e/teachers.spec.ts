import { expect, test } from "@playwright/test"

import { exams, login } from "./helpers.ts"

const CO_TEACHER = "wspolprowadzacy@e2e.test"

test("dodanie i usunięcie współprowadzącego, potem wypisanie się z zaliczenia", async ({
  page,
}) => {
  await login(page)
  await page.goto(`/zaliczenia/${exams().teachers}?tab=prowadzacy`)
  const email = page.getByLabel("E-mail prowadzącego")
  const add = page.getByRole("button", { name: "Dodaj prowadzącego" })
  const coTeacher = page.locator("li", { hasText: CO_TEACHER })
  const leave = page.getByRole("button", { name: "Wypisz się" })

  await expect(leave).toBeDisabled()
  await email.fill("nikt@e2e.test")
  await add.click()
  await expect(page.getByText("Nie ma prowadzącego z tym adresem.")).toBeVisible()

  await email.fill(CO_TEACHER)
  await add.click()
  await expect(page.getByText("Dodano prowadzącego.")).toBeVisible()
  await expect(coTeacher).toContainText("Druga Osoba E2E")
  await expect(email).toHaveValue("")
  await expect(leave).toBeEnabled()

  await coTeacher.getByRole("button", { name: "Usuń" }).click()
  await expect(coTeacher).toHaveCount(0)
  await expect(leave).toBeDisabled()

  await email.fill(CO_TEACHER)
  await add.click()
  await expect(coTeacher).toBeVisible()
  await leave.click()
  await expect(page.getByRole("dialog", { name: "Wypisać się z zaliczenia?" })).toBeVisible()
  await page.getByRole("dialog").getByRole("button", { name: "Wypisz się" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Moje zaliczenia" })).toBeVisible()
  await expect(page.getByText("Wspólne E2E")).toHaveCount(0)
})
