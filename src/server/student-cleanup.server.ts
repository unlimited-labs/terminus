import { db } from "./db.server.ts"
import { STUDENT_ROLE } from "./roles.ts"

/**
 * Sprzątanie kont studentów (zadanie Nitro): wygasłe sesje studentów, studenci bez sesji i bez wpisu
 * listy z ich adresem oraz wygasłe wiersze `verification`. Idempotentne, więc wiele instancji aplikacji
 * nie szkodzi.
 */
export async function cleanupStudents(now = new Date()) {
  const [sessions, users, verifications] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now }, user: { role: STUDENT_ROLE } } }),
    db.$executeRaw`
      DELETE FROM "user" u
      WHERE u."role" = ${STUDENT_ROLE}
        AND NOT EXISTS (SELECT 1 FROM "session" s WHERE s."userId" = u."id")
        AND NOT EXISTS (SELECT 1 FROM "roster_entry" r WHERE lower(r."email") = lower(u."email"))`,
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ])
  return { sessions: sessions.count, users, verifications: verifications.count }
}
