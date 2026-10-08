import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import {
  accountRefSchema,
  createAccountSchema,
  setAdminSchema,
  setBannedSchema,
  setPasswordSchema,
  updateAccountSchema,
} from "../schemas/account.ts"
import { deleteExamSchema } from "../schemas/exam.ts"

import {
  accountList,
  addAccount,
  deleteBlockedAccountExam,
  editAccount,
  listBlockedAccountExams,
  setAdmin,
  setBanned,
  setPassword,
} from "./account-ops.server.ts"
import { requireAdmin } from "./session.ts"

export const listAccounts = createServerFn()
  .middleware([requireAdmin])
  .handler(() => accountList(getRequestHeaders()))

export const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts"], queryFn: () => listAccounts() })

const blockedAccountExams = createServerFn()
  .middleware([requireAdmin])
  .validator(accountRefSchema)
  .handler(({ data }) => listBlockedAccountExams(getRequestHeaders(), data.userId))

export const blockedAccountExamsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["accounts", userId, "exams"],
    queryFn: () => blockedAccountExams({ data: { userId } }),
  })

export const deleteAccountExam = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(deleteExamSchema)
  .handler(({ data }) => deleteBlockedAccountExam(getRequestHeaders(), data))

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(createAccountSchema)
  .handler(({ data }) => addAccount(getRequestHeaders(), data))

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(updateAccountSchema)
  .handler(({ data }) => editAccount(getRequestHeaders(), data))

export const setAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setPasswordSchema)
  .handler(({ data }) => setPassword(getRequestHeaders(), data))

export const setAccountBanned = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setBannedSchema)
  .handler(({ data }) => setBanned(getRequestHeaders(), data))

export const setAccountAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(setAdminSchema)
  .handler(({ data }) => setAdmin(getRequestHeaders(), data))
