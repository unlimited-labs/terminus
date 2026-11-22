import { z } from "zod"

import { tooLong } from "../messages.pl.ts"
import { email } from "./auth.ts"

const name = z.string().trim().min(1, "Podaj imię i nazwisko.").max(100, tooLong(100))
const userId = z.string().min(1)

export const createAccountSchema = z.object({ email, name })
export const updateAccountSchema = z.object({ userId, email, name })
export const accountRefSchema = z.object({ userId })
export const setBannedSchema = z.object({ userId, banned: z.boolean() })
export const setAdminSchema = z.object({ userId, isAdmin: z.boolean() })
