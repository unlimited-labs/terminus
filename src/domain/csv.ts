import Papa from "papaparse"

import { warsawDay, warsawTime } from "./time.ts"

export type RosterRow = { line: number; studentNumber: string; firstName: string; lastName: string }
type InvalidRow = {
  line: number
  studentNumber: string
  reason: "NOT_DIGITS" | "DUPLICATE_IN_FILE"
}

export type ParsedRoster =
  | {
      ok: true
      rows: RosterRow[]
      /** `skreslony = 1` lub `rezygnacja = 1` — pomijane. */
      withdrawn: RosterRow[]
      invalid: InvalidRow[]
    }
  | { ok: false; code: "MISSING_COLUMNS"; columns: string[] }

const REQUIRED_COLUMNS = ["indeks", "imie", "nazwisko"]
const DIGITS = /^\d+$/

export function parseRosterCsv(text: string): ParsedRoster {
  const { data, meta } = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  })
  const missing = REQUIRED_COLUMNS.filter((c) => !meta.fields?.includes(c))
  if (missing.length > 0) return { ok: false, code: "MISSING_COLUMNS", columns: missing }

  const rows: RosterRow[] = []
  const withdrawn: RosterRow[] = []
  const invalid: InvalidRow[] = []
  const seen = new Set<string>()
  data.forEach((record, i) => {
    const row: RosterRow = {
      line: i + 2,
      studentNumber: record.indeks ?? "",
      firstName: record.imie ?? "",
      lastName: record.nazwisko ?? "",
    }
    if (record.skreslony === "1" || record.rezygnacja === "1") {
      withdrawn.push(row)
    } else if (!DIGITS.test(row.studentNumber)) {
      invalid.push({ line: row.line, studentNumber: row.studentNumber, reason: "NOT_DIGITS" })
    } else if (seen.has(row.studentNumber)) {
      invalid.push({
        line: row.line,
        studentNumber: row.studentNumber,
        reason: "DUPLICATE_IN_FILE",
      })
    } else {
      seen.add(row.studentNumber)
      rows.push(row)
    }
  })
  return { ok: true, rows, withdrawn, invalid }
}

export type ExistingEntry = {
  studentNumber: string
  rosterId: string
  firstName: string
  lastName: string
  enrolled: boolean
}

export type RosterImportPlan = {
  add: RosterRow[]
  update: RosterRow[]
  unchanged: number
  /** Błędne: indeks jest już na innej liście zaliczenia. */
  otherRoster: RosterRow[]
  /** Wycofani z tej listy bez zapisu — znikają. */
  remove: ExistingEntry[]
  /** Wycofani z tej listy z zapisem — zostają, oznaczeni w podglądzie. */
  withdrawnEnrolled: ExistingEntry[]
  /** Na tej liście, nieobecni w pliku — zostają. */
  notInFile: ExistingEntry[]
}

/** Co zrobi import do listy `rosterId`, przy wpisach `existing` całego zaliczenia. */
export function planRosterImport(
  parsed: Extract<ParsedRoster, { ok: true }>,
  rosterId: string,
  existing: ExistingEntry[],
): RosterImportPlan {
  const byNumber = new Map(existing.map((e) => [e.studentNumber, e]))
  const plan: RosterImportPlan = {
    add: [],
    update: [],
    unchanged: 0,
    otherRoster: [],
    remove: [],
    withdrawnEnrolled: [],
    notInFile: [],
  }
  for (const row of parsed.rows) {
    const current = byNumber.get(row.studentNumber)
    if (!current) plan.add.push(row)
    else if (current.rosterId !== rosterId) plan.otherRoster.push(row)
    else if (current.firstName !== row.firstName || current.lastName !== row.lastName)
      plan.update.push(row)
    else plan.unchanged++
  }
  const inFile = new Set(parsed.rows.map((r) => r.studentNumber))
  const withdrawn = new Set(parsed.withdrawn.map((r) => r.studentNumber))
  for (const entry of existing) {
    if (entry.rosterId !== rosterId || inFile.has(entry.studentNumber)) continue
    if (!withdrawn.has(entry.studentNumber)) plan.notInFile.push(entry)
    else if (entry.enrolled) plan.withdrawnEnrolled.push(entry)
    else plan.remove.push(entry)
  }
  return plan
}

/** `studenci_110-ITE-2S-027_g1_2026-09-30.csv` → `g1`; inaczej nazwa pliku bez rozszerzenia. */
export function suggestRosterName(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "")
  return /_([^_]+)_\d{4}-\d{2}-\d{2}$/.exec(base)?.[1] ?? base
}

export function exportFileName(examName: string, now: Date): string {
  return `${examName.replace(/[\\/:*?"<>|]/g, "-")}_${warsawDay(now)}.csv`
}

type ExportSlot = { id: string; startsAt: Date; endsAt: Date; answers?: Record<string, string> }
type ExportPerson = {
  studentNumber: string
  firstName: string
  lastName: string
  rosterName: string
  slotId: string | null
}

/** Eksport zapisów: wiersz na osobę, po początku slotu i nazwisku; niezapisani na końcu; potem kolumny dodatkowych pól. */
export function buildExportCsv(
  slots: ExportSlot[],
  people: ExportPerson[],
  fields: { id: string; label: string }[] = [],
): string {
  const slotById = new Map(slots.map((s) => [s.id, s]))
  const start = (p: ExportPerson) =>
    p.slotId ? slotById.get(p.slotId)!.startsAt.getTime() : Number.POSITIVE_INFINITY
  const rows = people
    .toSorted((a, b) => start(a) - start(b) || a.lastName.localeCompare(b.lastName, "pl"))
    .map((p) => {
      const slot = p.slotId ? slotById.get(p.slotId) : undefined
      return [
        slot ? warsawDay(slot.startsAt) : "",
        slot ? warsawTime(slot.startsAt) : "",
        slot ? warsawTime(slot.endsAt) : "",
        p.rosterName,
        p.studentNumber,
        p.lastName,
        p.firstName,
        ...fields.map((f) => slot?.answers?.[f.id] ?? ""),
      ]
    })
  return (
    "﻿" +
    Papa.unparse(
      {
        fields: [
          "data",
          "od",
          "do",
          "lista",
          "indeks",
          "nazwisko",
          "imie",
          ...fields.map((f) => f.label),
        ],
        data: rows,
      },
      { delimiter: ";", quotes: true, newline: "\r\n", escapeFormulae: true },
    )
  )
}
