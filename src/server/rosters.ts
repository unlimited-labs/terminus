import { createServerFn } from "@tanstack/react-start"

import {
  addEntrySchema,
  entryRefSchema,
  rosterImportSchema,
  rosterRefSchema,
} from "../schemas/roster.ts"

import {
  addEntry,
  applyImport,
  deleteEntry,
  previewImport,
  removeRoster,
} from "./roster-ops.server.ts"
import { requireUser } from "./session.ts"

export const previewRosterImport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterImportSchema)
  .handler(({ data, context }) =>
    previewImport(data.examId, context.user.id, data.rosterName, data.csv),
  )

export const applyRosterImport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterImportSchema)
  .handler(({ data, context }) =>
    applyImport(data.examId, context.user.id, data.rosterName, data.csv),
  )

export const addRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(addEntrySchema)
  .handler(({ data, context }) => addEntry(context.user.id, data))

export const deleteRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(entryRefSchema)
  .handler(({ data, context }) => deleteEntry(data.examId, context.user.id, data.studentNumber))

export const deleteRoster = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(rosterRefSchema)
  .handler(({ data, context }) => removeRoster(data.examId, context.user.id, data.rosterId))
