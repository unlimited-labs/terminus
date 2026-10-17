import { randomUUID } from "node:crypto"

import { beforeEach, expect, test, vi } from "vitest"

import { accountList, addAccount } from "@/server/account-ops.server"
import { auth, sessionUser } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { sendMail } from "@/server/mail.server"
import { addTeacher } from "@/server/exam-ops.server"
import { sessionEmail, studentAccess } from "@/server/student-access.server"

import { createExam, enroll } from "./fixtures"

vi.mock("@/server/mail.server", () => ({ sendMail: vi.fn<() => Promise<void>>() }))

const sent = vi.mocked(sendMail)
beforeEach(() => sent.mockReset())

/** Link z ostatniego maila do `email`: wywołuje to samo co `requestLink`. */
async function requestToken(examId: string, email: string) {
  await auth.api.signInMagicLink({ body: { email, metadata: { examId } }, headers: new Headers() })
  const text = sent.mock.calls.at(-1)![0].text
  return new URL(/https?:\/\/\S+/.exec(text)![0])
}

async function verify(token: string) {
  return auth.api.magicLinkVerify({
    query: { token },
    headers: new Headers(),
    asResponse: true,
  })
}

const cookieHeader = (response: Response) =>
  new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  })

const email = () => `${randomUUID()}@student.example.com`

test("link w mailu prowadzi na stronę wejścia zaliczenia i niesie token", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["1"], slots: [] } } })
  const link = await requestToken(examId, email())
  expect(link.pathname).toBe(`/z/${examId}/enter`)
  expect(link.searchParams.get("token")).toBeTruthy()
})

test("weryfikacja zakłada studenta (rola, bez hasła), sesja 24 h bez Max-Age, token jednorazowy", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["1"], slots: [] } } })
  const address = email()
  const token = (await requestToken(examId, address)).searchParams.get("token")!
  const response = await verify(token)
  expect(response.ok).toBe(true)

  const user = await db.user.findUniqueOrThrow({
    where: { email: address },
    include: { accounts: true, sessions: true },
  })
  expect(user).toMatchObject({ role: "student", emailVerified: true, accounts: [] })
  const [session] = user.sessions
  const hours = (session!.expiresAt.getTime() - Date.now()) / 3_600_000
  expect(hours).toBeGreaterThan(23.9)
  expect(hours).toBeLessThanOrEqual(24)

  const cookies = response.headers.getSetCookie()
  const sessionCookies = cookies.filter((c) => c.includes("session_token="))
  expect(sessionCookies.at(-1)).not.toMatch(/max-age/i)
  expect(cookies.some((c) => c.includes("dont_remember=true"))).toBe(true)

  const headers = cookieHeader(response)
  expect(await sessionEmail(headers)).toBe(address)
  // Student nie jest prowadzącym: wszystkie guardy opierają się na sessionUser.
  expect(await sessionUser(headers)).toBeNull()

  const again = await verify(token).catch((e: unknown) => e)
  expect(again instanceof Response ? again.ok : false).toBe(false)
})

test("link na adres prowadzącego (konto powstało po wysłaniu) nie loguje", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["1"], slots: [] } } })
  const address = email()
  const token = (await requestToken(examId, address)).searchParams.get("token")!
  await auth.api.createUser({
    body: { email: address, password: "haslo-123456", name: "Prowadzący", role: "user" },
  })
  const response = await verify(token).catch(() => null)
  expect(response?.headers.getSetCookie().some((c) => c.includes("session_token="))).toBeFalsy()
  expect(await db.session.count({ where: { user: { email: address } } })).toBe(0)
})

test("HTTP nie obsługuje punktów linku", async () => {
  for (const [method, path] of [
    ["POST", "sign-in/magic-link"],
    ["GET", "magic-link/verify?token=x"],
  ] as const) {
    const response = await auth.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ email: "a@b.pl" }) : undefined,
      }),
    )
    expect(response.status).toBe(404)
  }
})

test("konta zakładane przez panel mają zweryfikowany adres; student nie trafia na listę kont ani do prowadzących zaliczenia", async () => {
  const adminEmail = email()
  await auth.api.createUser({
    body: { email: adminEmail, password: "haslo-123456", name: "Szef", role: "admin" },
  })
  const signed = await auth.api.signInEmail({
    body: { email: adminEmail, password: "haslo-123456" },
    returnHeaders: true,
  })
  const admin = new Headers({
    cookie: signed.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  })
  const address = email()
  expect(
    await addAccount(admin, { email: address, name: "Nowy", password: "haslo-123456" }),
  ).toEqual({ ok: true })
  expect(await db.user.findUniqueOrThrow({ where: { email: address } })).toMatchObject({
    emailVerified: true,
  })

  const studentAddress = email()
  await db.user.create({
    data: {
      id: randomUUID(),
      name: "",
      email: studentAddress,
      emailVerified: true,
      role: "student",
    },
  })
  const listed = (await accountList(admin)).map((u) => u.email)
  expect(listed).toContain(address)
  expect(listed).not.toContain(studentAddress)

  const { examId, teacherId } = await createExam({ rosters: {} })
  expect(await addTeacher(examId, teacherId, studentAddress)).toEqual({
    ok: false,
    code: "TEACHER_NOT_FOUND",
  })
})

test("studentAccess: opcja wyłączona = otwarte; włączona = tylko adres z listy tego zaliczenia, bez względu na wielkość liter", async () => {
  const { examId } = await createExam({
    rosters: { g1: { students: ["1", "2", "3"], slots: [] } },
  })
  expect(await studentAccess(examId, null)).toEqual({ kind: "open" })
  await db.exam.update({ where: { id: examId }, data: { requireEmailLogin: true } })

  expect(await studentAccess(examId, null)).toEqual({ kind: "login" })
  expect(await studentAccess(examId, "obcy@example.com")).toEqual({ kind: "login" })
  expect(await studentAccess(examId, "1@STUDENT.agh.edu.pl")).toEqual({
    kind: "ok",
    email: "1@STUDENT.agh.edu.pl",
  })

  // Adres wspólny dla kilku indeksów autoryzuje wszystkie te indeksy.
  await db.rosterEntry.updateMany({ where: { examId }, data: { email: "wspolny@example.com" } })
  expect(await studentAccess(examId, "wspolny@example.com")).toMatchObject({ kind: "ok" })

  // Usunięcie z listy odbiera dostęp od następnego żądania.
  await db.rosterEntry.deleteMany({ where: { examId } })
  expect(await studentAccess(examId, "wspolny@example.com")).toEqual({ kind: "login" })
})

test("zespół musi zawierać indeks z adresem sesji (NOT_YOUR_INDEX), nie zdradzając listy", async () => {
  const { examId } = await createExam({
    maxTeamSize: 2,
    rosters: { g1: { students: ["1", "2"], slots: [new Date("2030-01-02T09:00:00Z")] } },
  })
  await db.rosterEntry.update({
    where: { examId_studentNumber: { examId, studentNumber: "1" } },
    data: { email: "ja@example.com" },
  })
  const asMe = { sessionEmail: "JA@example.com" }
  expect(await enroll(examId, ["2"], {}, asMe)).toEqual({ ok: false, code: "NOT_YOUR_INDEX" })
  expect(await enroll(examId, ["999"], {}, asMe)).toEqual({ ok: false, code: "NOT_YOUR_INDEX" })
  expect(await enroll(examId, ["1", "999"], {}, asMe)).toMatchObject({
    ok: false,
    code: "NOT_ON_ROSTER",
  })
  expect(await enroll(examId, ["1"], {}, asMe)).toMatchObject({ ok: true })
})
