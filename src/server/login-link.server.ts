import { consola } from "consola"

import { takeLinkAllowance } from "./attempt-limit.server.ts"
import { auth } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

type LinkResult =
  | "wysłano"
  | "nieznany"
  | "limit"
  | "błąd"
  | "wyłączone"
  | "adres konta prowadzącego"

/**
 * Jedyna droga wysyłki linku: adres bierze z listy, nigdy od wywołującego. Odpowiedź dla wywołującego
 * jest zawsze taka sama, więc wynik (poza logiem) nie zdradza, czy indeks jest na liście; wysyłka
 * nie jest czekana, żeby czas odpowiedzi też niczego nie zdradzał. Log bez adresu.
 */
export async function requestLoginLink(
  { examId, studentNumber }: { examId: string; studentNumber: string },
  ip: string,
): Promise<void> {
  const trace = (result: LinkResult) =>
    consola.info(`link ip=${ip} examId=${examId} indeks=${studentNumber} ${result}`)

  if (!(await takeLinkAllowance(ip, examId, studentNumber))) return trace("limit")
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { requireEmailLogin: true },
  })
  if (!exam?.requireEmailLogin || !emailLoginAvailable) return trace("wyłączone")
  const entry = await db.rosterEntry.findUnique({
    where: { examId_studentNumber: { examId, studentNumber } },
    select: { email: true },
  })
  if (!entry) return trace("nieznany")

  // Link potwierdza tylko własność skrzynki; przy koncie prowadzącego na ten adres nie wysyłamy nic.
  const teacher = await db.user.findFirst({
    where: {
      email: { equals: entry.email, mode: "insensitive" },
      OR: [{ role: null }, { role: { not: STUDENT_ROLE } }],
    },
    select: { id: true },
  })
  if (teacher) return trace("adres konta prowadzącego")

  auth.api
    .signInMagicLink({ body: { email: entry.email, metadata: { examId } }, headers: new Headers() })
    .then(() => trace("wysłano"))
    .catch((e: unknown) => {
      trace("błąd")
      consola.error(`link SMTP examId=${examId}`, smtpCode(e))
    })
}

/** Kod odpowiedzi SMTP albo nazwa błędu; bez adresu i treści. */
const smtpCode = (e: unknown) =>
  typeof e === "object" && e !== null && "responseCode" in e
    ? `kod=${String(e.responseCode)}`
    : e instanceof Error
      ? e.name
      : "nieznany"
