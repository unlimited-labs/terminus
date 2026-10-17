import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  buildExportCsv,
  exportFileName,
  parseRosterCsv,
  planRosterImport,
  suggestRosterName,
  type ExistingEntry,
} from "./csv"
import { defaultEmail } from "./email"

const fixture = readFileSync(
  new URL("./fixtures/studenci_110-ITE-2S-027_g1_2026-09-30.csv", import.meta.url),
  "utf8",
)

describe("parseRosterCsv", () => {
  test("czyta plik z BOM, CRLF i ;", () => {
    const result = parseRosterCsv(fixture)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toEqual([
      {
        line: 2,
        studentNumber: "400001",
        firstName: "Anna",
        lastName: "Nowak",
        email: "anna.nowak@student.example.com",
      },
      {
        line: 3,
        studentNumber: "400002",
        firstName: "Piotr",
        lastName: "Wiśniewski",
        email: "piotr.w@student.example.com",
      },
      {
        line: 7,
        studentNumber: "400006",
        firstName: "Ola",
        lastName: "Mazur",
        email: "ola.m@student.example.com",
      },
    ])
    expect(result.withdrawn.map((r) => r.studentNumber)).toEqual(["400003", "400004"])
    expect(result.invalid).toEqual([
      { line: 6, studentNumber: "40A005", reason: "NOT_DIGITS" },
      { line: 8, studentNumber: "400001", reason: "DUPLICATE_IN_FILE" },
    ])
  })

  test("za długi indeks i brak nazwiska to błędne wiersze, jak w formularzu", () => {
    const csv = `indeks;imie;nazwisko\n${"1".repeat(21)};Anna;Nowak\n500002;Jan;\n500003;Ewa;${"x".repeat(101)}\n`
    const result = parseRosterCsv(csv)
    if (!result.ok) throw new Error("parse")
    expect(result.rows).toEqual([])
    expect(result.invalid.map((r) => r.reason)).toEqual(["TOO_LONG", "BAD_NAME", "BAD_NAME"])
  })

  test("brak wymaganej kolumny odrzuca cały plik", () => {
    expect(parseRosterCsv('"nazwisko";"imie";"email"\r\n"A";"B";"c"\r\n')).toEqual({
      ok: false,
      code: "MISSING_COLUMNS",
      columns: ["indeks"],
    })
  })
})

const at = (studentNumber: string, email: string): ExistingEntry => ({
  studentNumber,
  rosterId: "g1",
  firstName: studentNumber === "1" ? "A" : studentNumber === "2" ? "B" : "C",
  lastName: studentNumber === "1" ? "A" : studentNumber === "2" ? "B" : "C",
  email,
  slotStartsAt: null,
})

describe("adresy e-mail w pliku", () => {
  const csv = [
    "indeks;imie;nazwisko;email",
    "1;A;A; Jan.Kowalski@AGH.edu.pl ",
    "2;B;B;",
    "3;C;C;nie-adres",
    `4;D;D;${"a".repeat(250)}@x.pl`,
  ].join("\n")

  test("zapisuje małymi literami, pusty i zły traktuje jak brak, zlicza złe", () => {
    const parsed = parseRosterCsv(csv)
    if (!parsed.ok) throw new Error("parse")
    expect(parsed.rows.map((r) => r.email)).toEqual(["jan.kowalski@agh.edu.pl", null, null, null])
    expect(parsed.badEmails).toBe(2)
  })

  test("plik bez kolumny email jest poprawny", () => {
    const parsed = parseRosterCsv("indeks;imie;nazwisko\n1;A;A")
    expect(parsed).toMatchObject({ ok: true, badEmails: 0, rows: [{ email: null }] })
  })

  test("domyślny adres to indeks@student.agh.edu.pl", () => {
    expect(defaultEmail("400001")).toBe("400001@student.agh.edu.pl")
  })

  test("reimport nadpisuje innym poprawnym adresem, pustego i zepsutego nie", () => {
    const parsed = parseRosterCsv(csv)
    if (!parsed.ok) throw new Error("parse")
    const plan = planRosterImport(parsed, "g1", [
      at("1", "stary@agh.edu.pl"),
      at("2", "reczny@agh.edu.pl"),
      at("3", "reczny@agh.edu.pl"),
    ])
    expect(plan.update.map((r) => r.studentNumber)).toEqual(["1"])
    expect(plan.unchanged).toBe(2)
  })
})

describe("planRosterImport", () => {
  const parsed = parseRosterCsv(fixture)
  if (!parsed.ok) throw new Error("fixture")

  test("pierwszy import: nowe indeksy, indeks z innej listy błędny", () => {
    const existing: ExistingEntry[] = [
      {
        studentNumber: "400006",
        rosterId: "g2",
        firstName: "Ola",
        lastName: "Mazur",
        email: "x@student.agh.edu.pl",
        slotStartsAt: null,
      },
    ]
    const plan = planRosterImport(parsed, "g1", existing)
    expect(plan.add.map((r) => r.studentNumber)).toEqual(["400001", "400002"])
    expect(plan.otherRoster.map((r) => r.studentNumber)).toEqual(["400006"])
    expect(plan.update).toEqual([])
    expect(plan.remove).toEqual([])
  })

  test("ponowny import: aktualizuje nazwiska, nieobecni zostają, skreśleni bez zapisu znikają", () => {
    const existing: ExistingEntry[] = [
      {
        studentNumber: "400001",
        rosterId: "g1",
        firstName: "Anna",
        lastName: "Nowak",
        email: "anna.nowak@student.example.com",
        slotStartsAt: new Date("2030-01-02T09:00:00Z"),
      },
      {
        studentNumber: "400002",
        rosterId: "g1",
        firstName: "Piotr",
        lastName: "Wisniewski",
        email: "x@student.agh.edu.pl",
        slotStartsAt: null,
      },
      {
        studentNumber: "400003",
        rosterId: "g1",
        firstName: "Ewa",
        lastName: "Zając",
        email: "x@student.agh.edu.pl",
        slotStartsAt: null,
      },
      {
        studentNumber: "400004",
        rosterId: "g1",
        firstName: "Adam",
        lastName: "Lis",
        email: "x@student.agh.edu.pl",
        slotStartsAt: new Date("2030-01-02T09:00:00Z"),
      },
      {
        studentNumber: "400099",
        rosterId: "g1",
        firstName: "Iza",
        lastName: "Byk",
        email: "x@student.agh.edu.pl",
        slotStartsAt: null,
      },
    ]
    const plan = planRosterImport(parsed, "g1", existing)
    expect(plan.add.map((r) => r.studentNumber)).toEqual(["400006"])
    expect(plan.update).toEqual([
      {
        line: 3,
        studentNumber: "400002",
        firstName: "Piotr",
        lastName: "Wiśniewski",
        email: "piotr.w@student.example.com",
      },
    ])
    expect(plan.unchanged).toBe(1)
    expect(plan.remove.map((e) => e.studentNumber)).toEqual(["400003", "400004"])
    expect(plan.withdrawnEnrolled.map((e) => e.studentNumber)).toEqual(["400004"])
    expect(plan.notInFile.map((e) => e.studentNumber)).toEqual(["400099"])
  })
})

test("suggestRosterName bierze grupę z nazwy pliku uczelni", () => {
  expect(suggestRosterName("studenci_110-ITE-2S-027_g1_2026-09-30.csv")).toBe("g1")
  expect(suggestRosterName("lista.csv")).toBe("lista")
  expect(suggestRosterName(`${"a".repeat(60)}.csv`)).toHaveLength(50)
})

test("exportFileName: nazwa zaliczenia i data eksportu", () => {
  expect(exportFileName('Fizyka: kolokwium 1/2 "A"', new Date("2026-10-01T22:30:00Z"))).toBe(
    "Fizyka- kolokwium 1-2 -A-_2026-10-02.csv",
  )
})

test("buildExportCsv: formuły w odpowiedziach, nazwiskach i etykietach nie wykonują się", () => {
  const slot = {
    id: "s1",
    startsAt: new Date("2026-10-05T07:00:00Z"),
    endsAt: new Date("2026-10-05T07:30:00Z"),
  }
  const person = {
    studentNumber: "1",
    firstName: "@a",
    lastName: "-b",
    rosterName: "g1",
    slotId: "s1",
    answers: { f1: '=HYPERLINK("http://evil.com","x")' },
  }
  const csv = buildExportCsv([slot], [person], [{ id: "f1", label: "+pole" }])
  expect(csv).not.toMatch(/(^|;|\n)"[=+\-@]/)
  expect(csv).toContain(`"'=HYPERLINK(`)
})

test("buildExportCsv: sortuje po slocie i nazwisku, niezapisani na końcu, wolne sloty pominięte", () => {
  const slots = [
    {
      id: "s2",
      startsAt: new Date("2026-10-05T08:00:00Z"),
      endsAt: new Date("2026-10-05T08:30:00Z"),
    },
    {
      id: "s1",
      startsAt: new Date("2026-10-05T07:00:00Z"),
      endsAt: new Date("2026-10-05T07:30:00Z"),
    },
    {
      id: "free",
      startsAt: new Date("2026-10-05T09:00:00Z"),
      endsAt: new Date("2026-10-05T09:30:00Z"),
    },
  ]
  const people = [
    { studentNumber: "3", firstName: "Ewa", lastName: "Źrebiec", rosterName: "g1", slotId: null },
    { studentNumber: "1", firstName: "Jan", lastName: "Żak", rosterName: "g1", slotId: "s1" },
    { studentNumber: "2", firstName: "Ola", lastName: "Łuk", rosterName: "g2", slotId: "s1" },
    { studentNumber: "4", firstName: "Adam", lastName: "Abc", rosterName: "g1", slotId: "s2" },
  ]
  expect(buildExportCsv(slots, people)).toBe(
    "﻿" +
      [
        '"data";"od";"do";"lista";"indeks";"nazwisko";"imie"',
        '"2026-10-05";"09:00";"09:30";"g2";"2";"Łuk";"Ola"',
        '"2026-10-05";"09:00";"09:30";"g1";"1";"Żak";"Jan"',
        '"2026-10-05";"10:00";"10:30";"g1";"4";"Abc";"Adam"',
        '"";"";"";"g1";"3";"Źrebiec";"Ewa"',
      ].join("\r\n"),
  )
})

test("buildExportCsv: dodatkowe pola zespołu jako kolumny po imieniu", () => {
  const slots = [
    {
      id: "s1",
      startsAt: new Date("2026-10-05T07:00:00Z"),
      endsAt: new Date("2026-10-05T07:30:00Z"),
    },
  ]
  const people = [
    {
      studentNumber: "1",
      firstName: "Jan",
      lastName: "Żak",
      rosterName: "g1",
      slotId: "s1",
      answers: { title: "Robot" },
    },
  ]
  const fields = [
    { id: "title", label: "Tytuł projektu" },
    { id: "notes", label: "Uwagi" },
  ]
  expect(buildExportCsv(slots, people, fields).split("\r\n")).toEqual([
    `﻿"data";"od";"do";"lista";"indeks";"nazwisko";"imie";"Tytuł projektu";"Uwagi"`,
    `"2026-10-05";"09:00";"09:30";"g1";"1";"Żak";"Jan";"Robot";""`,
  ])
})
