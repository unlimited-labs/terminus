import { readFileSync } from "node:fs"

import { expect, type Locator, type Page } from "@playwright/test"
import { z } from "zod"

import { formatDayShort, warsawDateTime } from "../src/domain/time.ts"

import { dayOf, E2E, MAIL_FILE, STATE_FILE, e2eStateSchema, type E2EState } from "./config.ts"
import { totpCode } from "./totp.ts"

const state = (): E2EState => e2eStateSchema.parse(JSON.parse(readFileSync(STATE_FILE, "utf8")))

export const exams = () => state().exams

const mailsSchema = z.array(z.object({ to: z.string(), subject: z.string(), text: z.string() }))
const mailsTo = (address: string) =>
  mailsSchema.parse(JSON.parse(readFileSync(MAIL_FILE, "utf8"))).filter((m) => m.to === address)

/** Liczba maili, które fałszywy SMTP odebrał dla adresu. */
export const mailCount = (address: string) => mailsTo(address).length

/** Link z ostatniego maila do adresu (ścieżka i token) albo `undefined`, gdy maila nie ma. */
export function lastMailLink(address: string): string | undefined {
  const text = mailsTo(address).at(-1)?.text
  const link = text && /https?:\/\/\S+/.exec(text)?.[0]
  return link ? link : undefined
}

/** Dzień danych testowych (YYYY-MM-DD) i jego etykieta jak w aplikacji, np. „śr 9.10”. */
export const day = (offset: number) => dayOf(state().baseDay, offset)
export const dayLabel = (offset: number) => formatDayShort(warsawDateTime(day(offset), "12:00"))

/** Wiersz slotu na tablicy po godzinie i panel „Niezapisani”. */
export const row = (page: Page, time: string) => page.locator("tr", { hasText: time })
export const pool = (page: Page) => page.getByRole("complementary", { name: "Niezapisani" })

/** Tablica zapisów zaliczenia (prowadzący musi być zalogowany). */
export async function openBoard(page: Page, examId: string) {
  await page.goto(`/zaliczenia/${examId}/tablica`)
  await page.getByRole("heading", { name: /tablica zapisów/ }).waitFor()
}

export async function fillLogin(page: Page, email: string, password: string) {
  // Przewodnik prowadzącego zasłaniałby stronę po zalogowaniu; sprawdza go tylko tour.spec.ts.
  await page.evaluate(() => localStorage.setItem("terminus:tour-done", "1"))
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Hasło", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Zaloguj się" }).click()
}

/** Zaproszenie z panelu kont (superadmin zalogowany). */
export async function invite(page: Page, name: string, email: string) {
  await page.goto("/konta")
  const form = page.locator("form", { hasText: "Wyślij zaproszenie" })
  await form.getByLabel("Imię i nazwisko").fill(name)
  await form.getByLabel("E-mail").fill(email)
  await form.getByRole("button", { name: "Wyślij zaproszenie" }).click()
  await expect(page.locator("li", { hasText: email })).toContainText("Zaproszone")
}

/** Logowanie hasłem i kodem z aplikacji (domyślnie superadmin z TOTP z `seed.ts`). */
export async function login(
  page: Page,
  email = E2E.admin.email,
  password = E2E.admin.password,
  totpURI = state().adminTotp,
) {
  await page.goto("/login")
  await fillLogin(page, email, password)
  await page.getByLabel("Kod z aplikacji").fill(await totpCode(totpURI))
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
