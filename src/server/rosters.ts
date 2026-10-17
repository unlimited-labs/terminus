import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import {
  addEntrySchema,
  entryEmailSchema,
  entryRefSchema,
  rosterApplySchema,
  rosterImportSchema,
  rosterRefSchema,
} from "../schemas/roster.ts"

import {
  addEntry,
  applyImport,
  deleteEntry,
  entryEmails,
  previewImport,
  removeRoster,
  setEntryEmail,
} from "./roster-ops.server.ts"
import { examIdSchema } from "../schemas/exam.ts"
import { requireUser } from "./session.ts"

export const previewRosterImport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterImportSchema)
  .handler(({ data, context }) =>
    previewImport(data.examId, context.user.id, data.rosterName, data.csv),
  )

export const applyRosterImport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterApplySchema)
  .handler(({ data, context }) =>
    applyImport(data.examId, context.user.id, data.rosterName, data.csv, data.withdrawnEnrolled),
  )

export const addRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(addEntrySchema)
  .handler(({ data, context }) => addEntry(data.examId, context.user.id, data))

export const deleteRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(entryRefSchema)
  .handler(({ data, context }) => deleteEntry(data.examId, context.user.id, data.studentNumber))

export const deleteRoster = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterRefSchema)
  .handler(({ data, context }) => removeRoster(data.examId, context.user.id, data.rosterId))

const getEntryEmails = createServerFn()
  .middleware([requireUser])
  .validator(examIdSchema)
  .handler(({ data, context }) => entryEmails(data.examId, context.user.id))

/** Klucz pod `["exam", id]`, więc każda zmiana zaliczenia odświeża też adresy. */
export const entryEmailsQuery = (examId: string) =>
  queryOptions({
    queryKey: ["exam", examId, "emails"],
    queryFn: () => getEntryEmails({ data: { examId } }),
  })

export const changeEntryEmail = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(entryEmailSchema)
  .handler(({ data, context }) =>
    setEntryEmail(data.examId, context.user.id, data.studentNumber, data.email),
  )
