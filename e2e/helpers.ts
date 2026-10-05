import { readFileSync } from "node:fs"

import type { Locator, Page } from "@playwright/test"

import { warsawDateTime } from "../src/domain/slots.ts"
import { formatDayShort } from "../src/domain/time.ts"

import { dayOf, E2E, STATE_FILE, e2eStateSchema, type E2EState } from "./config.ts"

export const state = (): E2EState =>
  e2eStateSchema.parse(JSON.parse(readFileSync(STATE_FILE, "utf8")))

export const exams = () => state().exams

/** Dzień danych testowych (YYYY-MM-DD) i jego etykieta jak w aplikacji, np. „śr 9.10”. */
export const day = (offset: number) => dayOf(state().baseDay, offset)
export const dayLabel = (offset: number) => formatDayShort(warsawDateTime(day(offset), "12:00"))

/** Tablica zapisów zaliczenia (prowadzący musi być zalogowany). */
export async function openBoard(page: Page, examId: string) {
  await page.goto(`/zaliczenia/${examId}/tablica`)
  await page.getByRole("heading", { name: /tablica zapisów/ }).waitFor()
}

export async function login(page: Page, email = E2E.admin.email, password = E2E.admin.password) {
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Hasło").fill(password)
  await page.getByRole("button", { name: "Zaloguj się" }).click()
  await page.waitForURL((url) => url.pathname !== "/login")
}

const center = async (locator: Locator) => {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Przeciąganie myszą z ruchem pośrednim (czujnik wskaźnika dnd-kit potrzebuje kilku zdarzeń). */
export async function dragWithMouse(page: Page, source: Locator, target: Locator) {
  const from = await center(source)
  const to = await center(target)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 5 })
  await page.mouse.move(to.x, to.y, { steps: 15 })
  await page.mouse.up()
}

/** Przeciąganie klawiaturą: Spacja, strzałki (Shift = 50 px, bez = 10 px), Spacja. */
export async function dragWithKeyboard(page: Page, source: Locator, target: Locator) {
  const from = await center(source)
  const to = await center(target)
  await source.focus()
  await page.keyboard.press("Space")
  const press = async (delta: number, forward: string, backward: string) => {
    const key = delta > 0 ? forward : backward
    const distance = Math.abs(delta)
    for (let i = 0; i < Math.floor(distance / 50); i++) await page.keyboard.press(`Shift+${key}`)
    for (let i = 0; i < Math.round((distance % 50) / 10); i++) await page.keyboard.press(key)
  }
  await press(to.y - from.y, "ArrowDown", "ArrowUp")
  await press(to.x - from.x, "ArrowRight", "ArrowLeft")
  await page.keyboard.press("Space")
}
