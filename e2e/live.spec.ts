import { expect, test, type Page } from "@playwright/test"

import {
  dragWithKeyboard,
  dragWithMouse,
  exams,
  hydrated,
  login,
  openBoard,
  pool,
  row,
} from "./helpers.ts"

declare global {
  interface Window {
    channelOpen?: boolean
    signals?: number
    flashed?: boolean
  }
}

/** Śledzi kanał zmian strony (wywołać przed `goto`): czy połączony i ile sygnałów doszło. */
async function watchChannel(page: Page) {
  await page.addInitScript(() => {
    window.EventSource = class extends window.EventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        this.addEventListener("open", () => (window.channelOpen = true))
        this.addEventListener("message", () => (window.signals = (window.signals ?? 0) + 1))
      }
    }
  })
  return {
    open: () => page.evaluate(() => window.channelOpen === true),
    signals: () => page.evaluate(() => window.signals ?? 0),
  }
}

test("prowadzący przenosi studenta na tablicy → strona studenta zmienia się bez przeładowania", async ({
  page,
  browser,
}) => {
  const examId = exams().liveStudent
  await login(page)
  await openBoard(page, examId)

  const student = await browser.newPage()
  await student.goto(`/z/${examId}`)
  const taken = student.getByRole("button", { name: /zajęty: Bartosz Bąk/ })
  await expect(taken).toHaveAccessibleName(/09:00/)
  await hydrated(taken)

  const tile = page.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await dragWithKeyboard(page, tile, row(page, "09:40–10:00"))
  await expect(page.getByText("Przeniesiono.")).toBeVisible()

  await expect(taken).toHaveAccessibleName(/09:40/)
  await student.close()
})

test("student się zapisuje → tablica prowadzącego pokazuje go bez przeładowania", async ({
  page,
  browser,
}) => {
  const examId = exams().liveBoard
  await login(page)
  await openBoard(page, examId)
  await expect(pool(page).getByText("500003")).toBeVisible()

  const student = await browser.newPage()
  await student.goto(`/z/${examId}`)
  await hydrated(student.getByRole("button", { name: "Zapisz się" }))
  await student.getByRole("button", { name: "Zapisz się" }).click()
  await student.getByLabel("Osoba 1 — numer indeksu").fill("500003")
  await student.getByRole("button", { name: "Losuj slot" }).click()
  await expect(student.getByText("Slot jest przydzielony na stałe.")).toBeVisible()
  await student.close()

  await expect(page.locator("tbody")).toContainText("Celina Cis")
  await expect(pool(page).getByText("500003")).toHaveCount(0)
})

test("dwóch prowadzących: zmiana B dochodzi do A po jego kolejce, kafelki A nie wracają", async ({
  page,
  browser,
}) => {
  const examId = exams().liveQueue
  const channel = await watchChannel(page)
  await login(page)
  await openBoard(page, examId)
  await expect.poll(channel.open).toBe(true)

  const held = Promise.withResolvers<void>()
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() === "POST") await held.promise
    await route.continue()
  })
  const reads: string[] = []
  page.on("request", (r) => {
    if (r.method() === "GET" && r.url().includes("/_serverFn/")) reads.push(r.url())
  })

  await dragWithMouse(page, pool(page).getByText("500003"), row(page, "09:40–10:00"))
  await expect(row(page, "09:40–10:00")).toContainText("Celina Cis")
  // Ślad, gdyby którakolwiek zmiana strony zabrała z 09:40 kafelek dodany przez A.
  await page.evaluate(() => {
    new MutationObserver(() => {
      const slot = [...document.querySelectorAll("tr")].find((tr) =>
        tr.textContent?.includes("09:40–10:00"),
      )
      if (!slot?.textContent?.includes("Celina Cis")) window.flashed = true
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
  const signalsBefore = await channel.signals()

  const other = await browser.newPage()
  await login(other)
  await openBoard(other, examId)
  await dragWithMouse(
    other,
    await hydrated(pool(other).getByText("500002")),
    row(other, "09:20–09:40"),
  )
  await expect(other.getByText("Zapisano ręcznie.")).toBeVisible()
  await other.close()

  await expect.poll(channel.signals).toBeGreaterThan(signalsBefore)
  // Czas, w którym nieodłożony sygnał zdążyłby pobrać zaliczenie i podmienić tablicę.
  await page.waitForTimeout(500)
  expect(reads).toEqual([])
  await expect(row(page, "09:20–09:40")).toContainText("wolny")

  held.resolve()
  await expect(page.getByText("Zapisano ręcznie.")).toBeVisible()
  await expect(row(page, "09:20–09:40")).toContainText("Bartosz Bąk")
  await expect(row(page, "09:40–10:00")).toContainText("Celina Cis")
  expect(await page.evaluate(() => window.flashed)).toBeUndefined()
})

test("w trakcie przeciągania zmiana z zewnątrz czeka na upuszczenie", async ({ page, browser }) => {
  const examId = exams().liveDrag
  const channel = await watchChannel(page)
  await login(page)
  await openBoard(page, examId)
  await expect.poll(channel.open).toBe(true)

  const tile = page.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await hydrated(tile)
  await tile.focus()
  await page.keyboard.press("Space")
  await expect(page.getByRole("status")).toContainText("Bartosz Bąk")
  const signalsBefore = await channel.signals()

  const other = await browser.newPage()
  await login(other)
  await openBoard(other, examId)
  const otherTile = other.locator("[aria-roledescription]", { hasText: "Bartosz Bąk" })
  await dragWithKeyboard(other, await hydrated(otherTile), row(other, "09:40–10:00"))
  await expect(other.getByText("Przeniesiono.")).toBeVisible()
  await other.close()

  await expect.poll(channel.signals).toBeGreaterThan(signalsBefore)
  await page.waitForTimeout(500)
  await expect(row(page, "09:20–09:40")).toContainText("Bartosz Bąk")

  await page.keyboard.press("Escape")
  await expect(row(page, "09:40–10:00")).toContainText("Bartosz Bąk")
  await expect(row(page, "09:20–09:40")).toContainText("wolny")
})
