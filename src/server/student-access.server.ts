import { ACCESS_DENIED } from "../messages.pl.ts"

import { auth } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { emailLoginAvailable } from "./env.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

/**
 * Co student może w zaliczeniu: `open` (opcja wyłączona albo brak zaliczenia), `ok` (zalogowany,
 * adres jest na liście), `login` (trzeba się zalogować), `unavailable` (opcja włączona, brak SMTP).
 */
export type StudentAccess =
  | { kind: "open" }
  | { kind: "ok"; email: string; studentNumber: string }
  | { kind: "login" }
  | { kind: "unavailable" }

/** Adres z sesji studenta; sesja prowadzącego albo zablokowanego konta nie daje dostępu. */
export async function sessionEmail(headers: Headers): Promise<string | null> {
  const user = (await auth.api.getSession({ headers }))?.user
  return user?.role === STUDENT_ROLE && !user.banned ? user.email : null
}

/** Czy zaliczenie ma włączone logowanie mailem (bez sprawdzania SMTP). */
export async function emailLoginRequired(examId: string): Promise<boolean> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { requireEmailLogin: true },
  })
  return exam?.requireEmailLogin ?? false
}

/**
 * Dostęp liczony przy każdym żądaniu z bieżącej listy: usunięcie z listy albo zmiana adresu odbiera go
 * od następnego żądania; w sesji nie ma zaliczenia ani indeksu.
 */
export async function studentAccess(
  examId: string,
  email: string | null,
  /** Już odczytane `requireEmailLogin` (bez ponownego zapytania). */
  required?: boolean,
): Promise<StudentAccess> {
  if (!(required ?? (await emailLoginRequired(examId)))) return { kind: "open" }
  if (!emailLoginAvailable) return { kind: "unavailable" }
  if (!email) return { kind: "login" }
  // Przy wielu indeksach z jednym adresem pierwszy (plakietka na stronie zapisów).
  const entry = await db.rosterEntry.findFirst({
    where: { examId, email: { equals: email, mode: "insensitive" } },
    orderBy: { studentNumber: "asc" },
    select: { studentNumber: true },
  })
  return entry ? { kind: "ok", email, studentNumber: entry.studentNumber } : { kind: "login" }
}

/** Czy student widzi harmonogram: bramka otwarta albo zalogowany adres z listy. */
export const studentAllowed = (
  access: StudentAccess,
): access is Extract<StudentAccess, { kind: "open" | "ok" }> =>
  access.kind === "open" || access.kind === "ok"

/** Dla funkcji serwerowych studenta: poza `open` i `ok` odmowa, po której strona wraca do ekranu logowania. */
export async function requireStudent(examId: string, headers: Headers) {
  const access = await studentAccess(examId, await sessionEmail(headers))
  if (!studentAllowed(access)) throw new Error(ACCESS_DENIED)
  return access
}
