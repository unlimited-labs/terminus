import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import {
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  setPasswordSchema,
  updateAccountSchema,
} from "../schemas/account.ts"

import { addAccount, editAccount, setAdmin, setBanned, setPassword } from "./account-ops.server.ts"
import { db } from "./db.server.ts"
import { requireAdmin } from "./session.ts"

export const listAccounts = createServerFn()
  .middleware([requireAdmin])
  .handler(() =>
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, banned: true },
    }),
  )

export const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts"], queryFn: () => listAccounts() })

// Uprawnienia admina sprawdza każda operacja w account-ops.server.ts (z tych samych nagłówków).
export const createAccount = createServerFn({ method: "POST" })
  .validator(createAccountSchema)
  .handler(({ data }) => addAccount(getRequestHeaders(), data))

export const updateAccount = createServerFn({ method: "POST" })
  .validator(updateAccountSchema)
  .handler(({ data }) => editAccount(getRequestHeaders(), data))

export const setAccountPassword = createServerFn({ method: "POST" })
  .validator(setPasswordSchema)
  .handler(({ data }) => setPassword(getRequestHeaders(), data))

export const setAccountBanned = createServerFn({ method: "POST" })
  .validator(setBannedSchema)
  .handler(({ data }) => setBanned(getRequestHeaders(), data))

export const setAccountAdmin = createServerFn({ method: "POST" })
  .validator(setAdminSchema)
  .handler(({ data }) => setAdmin(getRequestHeaders(), data))
