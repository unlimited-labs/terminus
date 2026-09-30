import { z } from "zod"

export const email = z.email("Podaj poprawny adres e-mail.").trim().toLowerCase()
export const password = z.string().min(8, "Hasło musi mieć co najmniej 8 znaków.").max(128)

export const loginSchema = z.object({ email, password: z.string().min(1, "Podaj hasło.") })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Podaj obecne hasło."),
  newPassword: password,
})
