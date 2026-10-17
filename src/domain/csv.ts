import Papa from "papaparse"

import { GRADE } from "../messages.pl.ts"
import type { Grade } from "./board.ts"
import { normalizeEmail } from "./email.ts"
import { PERSON_NAME_MAX, ROSTER_NAME_MAX, STUDENT_NUMBER_MAX } from "./limits.ts"
import { warsawDay, warsawTime } from "./time.ts"

export type RosterRow = {
  line: number
  studentNumber: string
  firstName: string
  lastName: string
  /** Poprawny adres z pliku (małe litery); `null` = pusty albo niepoprawny, wtedy działa adres domyślny. */
  email: string | null
}
export type InvalidRowReason = "NOT_DIGITS" | "TOO_LONG" | "BAD_NAME" | "DUPLICATE_IN_FILE"
type InvalidRow = { line: number; studentNumber: string; reason: InvalidRowReason }

export type ParsedRoster =
  | {
      ok: true
      rows: RosterRow[]
      /** `skreslony = 1` lub `rezygnacja = 1` — pomijane. */
      withdrawn: RosterRow[]
      invalid: InvalidRow[]
      /** Wiersze z niepustym, niepoprawnym adresem — adres zastąpiony domyślnym. */
      badEmails: number
    }
  | { ok: false; code: "MISSING_COLUMNS"; columns: string[] }

const REQUIRED_COLUMNS = ["indeks", "imie", "nazwisko"]
const DIGITS = /^\d+$/

const badName = (name: string) => name === "" || name.length > PERSON_NAME_MAX

function invalidReason(row: RosterRow, seen: Set<string>): InvalidRowReason | null {
  if (!DIGITS.test(row.studentNumber)) return "NOT_DIGITS"
  if (row.studentNumber.length > STUDENT_NUMBER_MAX) return "TOO_LONG"
  if (badName(row.firstName) || badName(row.lastName)) return "BAD_NAME"
  if (seen.has(row.studentNumber)) return "DUPLICATE_IN_FILE"
  return null
}

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
  let badEmails = 0
  data.forEach((record, i) => {
    const rawEmail = record.email ?? ""
    const row: RosterRow = {
      line: i + 2,
      studentNumber: record.indeks ?? "",
      firstName: record.imie ?? "",
      lastName: record.nazwisko ?? "",
      email: normalizeEmail(rawEmail),
    }
    if (record.skreslony === "1" || record.rezygnacja === "1") {
      withdrawn.push(row)
      return
    }
    const reason = invalidReason(row, seen)
    if (reason) {
      invalid.push({ line: row.line, studentNumber: row.studentNumber, reason })
      return
    }
    if (rawEmail !== "" && row.email === null) badEmails++
    seen.add(row.studentNumber)
    rows.push(row)
  })
  return { ok: true, rows, withdrawn, invalid, badEmails }
}

export type ExistingEntry = {
  studentNumber: string
  rosterId: string
  firstName: string
  lastName: string
  email: string
  /** Początek slotu, w którym osoba ma zapis; `null` = bez zapisu. */
  slotStartsAt: Date | null
  /** Ocena z zapisu: podgląd pokazuje, co zniknie razem z zapisem wycofanej osoby. */
  grade: Grade | null
}

export type RosterImportPlan = {
  add: RosterRow[]
  update: RosterRow[]
  unchanged: number
  /** Błędne: indeks jest już na innej liście zaliczenia. */
  otherRoster: RosterRow[]
  /** Wycofani z tej listy — znikają (z zapisem: razem z nim). */
  remove: ExistingEntry[]
  /** Ci z `remove`, którzy mają zapis — podgląd pokazuje ich slot, zanim zapis zniknie. */
  withdrawnEnrolled: (ExistingEntry & { slotStartsAt: Date })[]
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
    else if (
      current.firstName !== row.firstName ||
      current.lastName !== row.lastName ||
      (row.email !== null && row.email !== current.email)
    )
      plan.update.push(row)
    else plan.unchanged++
  }
  const inFile = new Set(parsed.rows.map((r) => r.studentNumber))
  const withdrawn = new Set(parsed.withdrawn.map((r) => r.studentNumber))
  const absent = existing.filter((e) => e.rosterId === rosterId && !inFile.has(e.studentNumber))
  plan.notInFile = absent.filter((e) => !withdrawn.has(e.studentNumber))
  plan.remove = absent.filter((e) => withdrawn.has(e.studentNumber))
  plan.withdrawnEnrolled = plan.remove.filter(
    (e): e is ExistingEntry & { slotStartsAt: Date } => e.slotStartsAt !== null,
  )
  return plan
}

/** `studenci_110-ITE-2S-027_g1_2026-09-30.csv` → `g1`; inaczej nazwa pliku bez rozszerzenia. */
export function suggestRosterName(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "")
  return (/_([^_]+)_\d{4}-\d{2}-\d{2}$/.exec(base)?.[1] ?? base).slice(0, ROSTER_NAME_MAX)
}

export function exportFileName(examName: string, now: Date): string {
  return `${examName.replace(/[\\/:*?"<>|]/g, "-")}_${warsawDay(now)}.csv`
}

type ExportSlot = { id: string; startsAt: Date; endsAt: Date }
type ExportPerson = {
  studentNumber: string
  firstName: string
  lastName: string
  rosterName: string
  slotId: string | null
  answers?: Record<string, string>
  grade?: Grade | null
  gradeComment?: string | null
}

/**
 * Eksport zapisów: wiersz na osobę, po początku slotu i nazwisku; niezapisani na końcu;
 * ocena i komentarz po imieniu, potem kolumny dodatkowych pól.
 */
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
        p.grade ? GRADE[p.grade].csv : "",
        p.gradeComment ?? "",
        ...fields.map((f) => p.answers?.[f.id] ?? ""),
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
          "ocena",
          "komentarz",
          ...fields.map((f) => f.label),
        ],
        data: rows,
      },
      { delimiter: ";", quotes: true, newline: "\r\n", escapeFormulae: true },
    )
  )
}
