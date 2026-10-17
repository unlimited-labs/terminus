import { randomUUID } from "node:crypto"

import { beforeEach, expect, test, vi } from "vitest"

import { auth } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { requestLoginLink } from "@/server/login-link.server"
import { sendMail } from "@/server/mail.server"

import { createExam } from "./fixtures"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

const sent = vi.mocked(sendMail)
beforeEach(() => sent.mockReset())

async function examWithLogin(option = true) {
  const { examId } = await createExam({ rosters: { g1: { students: ["1", "2"], slots: [] } } })
  await db.exam.update({ where: { id: examId }, data: { requireEmailLogin: option } })
  return examId
}

const ip = () => randomUUID()

/** Wysyłka nie jest czekana, więc daje jej chwilę. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150))

test("indeks z listy: mail na adres z listy z linkiem do strony wejścia zaliczenia", async () => {
  const examId = await examWithLogin()
  await requestLoginLink({ examId, studentNumber: "1" }, ip())
  await vi.waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
  const [mail] = sent.mock.calls[0]!
  expect(mail).toMatchObject({ to: "1@student.agh.edu.pl" })
  expect(mail.text).toContain(`/z/${examId}/enter?token=`)
})

test("nieznany indeks, opcja wyłączona i zaliczenie spoza bazy: bez maila", async () => {
  const examId = await examWithLogin()
  await requestLoginLink({ examId, studentNumber: "999" }, ip())
  await requestLoginLink({ examId: await examWithLogin(false), studentNumber: "1" }, ip())
  await requestLoginLink({ examId: randomUUID(), studentNumber: "1" }, ip())
  await settle()
  expect(sent).not.toHaveBeenCalled()
})

test("adres konta prowadzącego: bez maila, a konto zostaje nietknięte", async () => {
  const examId = await examWithLogin()
  await db.rosterEntry.update({
    where: { examId_studentNumber: { examId, studentNumber: "1" } },
    data: { email: "Prowadzacy@example.com".toLowerCase() },
  })
  await auth.api.createUser({
    body: {
      email: "prowadzacy@example.com",
      password: "haslo-123456",
      name: "Prowadzący",
      role: "user",
      data: { emailVerified: true },
    },
  })
  await requestLoginLink({ examId, studentNumber: "1" }, ip())
  await settle()
  expect(sent).not.toHaveBeenCalled()
  expect(await db.account.count({ where: { user: { email: "prowadzacy@example.com" } } })).toBe(1)
})

test("czwarta prośba o ten sam indeks w godzinę nie wysyła czwartego maila", async () => {
  const examId = await examWithLogin()
  for (let i = 0; i < 4; i++) await requestLoginLink({ examId, studentNumber: "2" }, ip())
  await vi.waitFor(() => expect(sent).toHaveBeenCalledTimes(3))
  await settle()
  expect(sent).toHaveBeenCalledTimes(3)
})

test("błąd poczty nie przerywa odpowiedzi", async () => {
  const examId = await examWithLogin()
  sent.mockRejectedValueOnce(Object.assign(new Error("smtp"), { responseCode: 550 }))
  await expect(requestLoginLink({ examId, studentNumber: "1" }, ip())).resolves.toBeUndefined()
  await settle()
})
