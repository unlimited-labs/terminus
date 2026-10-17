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
  | { kind: "ok"; email: string }
  | { kind: "login" }
  | { kind: "unavailable" }

/** Adres z sesji studenta; sesja prowadzącego albo zablokowanego konta nie daje dostępu. */
export async function sessionEmail(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers })
  const user = session?.user as
    | { email: string; role?: string | null; banned?: boolean | null }
    | undefined
  return user && user.role === STUDENT_ROLE && !user.banned ? user.email : null
}

/**
 * Dostęp liczony przy każdym żądaniu z bieżącej listy: usunięcie z listy albo zmiana adresu odbiera go
 * od następnego żądania; w sesji nie ma zaliczenia ani indeksu.
 */
export async function studentAccess(examId: string, email: string | null): Promise<StudentAccess> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { requireEmailLogin: true },
  })
  if (!exam?.requireEmailLogin) return { kind: "open" }
  if (!emailLoginAvailable) return { kind: "unavailable" }
  if (!email) return { kind: "login" }
  const onList = await db.rosterEntry.count({
    where: { examId, email: { equals: email, mode: "insensitive" } },
  })
  return onList > 0 ? { kind: "ok", email } : { kind: "login" }
}

/** Dla funkcji serwerowych studenta: poza `open` i `ok` odmowa, po której strona wraca do ekranu logowania. */
export async function requireStudent(examId: string, headers: Headers) {
  const access = await studentAccess(examId, await sessionEmail(headers))
  if (access.kind !== "open" && access.kind !== "ok") throw new Error(ACCESS_DENIED)
  return access
}
