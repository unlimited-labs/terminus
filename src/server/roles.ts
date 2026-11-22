/** Rola wiersza `user` zakładanego linkiem logowania; prowadzący mają `user` albo `admin`. */
export const STUDENT_ROLE = "student"

/** Konto prowadzącego; `not` w Prismie pomija `role: null`, stąd osobna gałąź. */
export const notStudent = { OR: [{ role: null }, { role: { not: STUDENT_ROLE } }] }

/** Konto logowania hasłem; brak go u prowadzącego = konto zaproszone. */
export const passwordAccount = { providerId: "credential" }

/** Konto prowadzącego z tym adresem (bez rozróżniania wielkości liter). */
export const teacherWithEmail = (email: string) => ({
  email: { equals: email, mode: "insensitive" as const },
  ...notStudent,
})
