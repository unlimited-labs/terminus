import { randomUUID } from "node:crypto"

import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { withExamLock } from "@/server/exam-access.server"
import { examCsv } from "@/server/exam-ops.server"
import { loadExam } from "@/server/exam-state.server"
import {
  addEntry,
  applyImport,
  deleteEntry,
  entryEmails,
  previewImport,
  removeRoster,
  setEntryEmail,
} from "@/server/roster-ops.server"

import { createExam, enroll, inDays } from "./fixtures"

const csv = (...rows: string[]) => ["indeks;imie;nazwisko;skreslony", ...rows].join("\n")

const people = async (examId: string) =>
  (
    await db.rosterEntry.findMany({
      where: { examId },
      include: { roster: { select: { name: true } } },
      orderBy: { studentNumber: "asc" },
    })
  ).map((e) => [e.roster.name, e.studentNumber, e.firstName, e.lastName])

test("pierwszy import tworzy listę; ponowny dodaje, poprawia i skreśla — także z zapisem", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  expect(
    await applyImport(
      examId,
      teacherId,
      "g1",
      csv("1;Ala;A;0", "2;Bob;B;0", "3;Cyd;C;0", "5;Eda;E;0"),
      [],
    ),
  ).toEqual({ ok: true })
  expect(await people(examId)).toEqual([
    ["g1", "1", "Ala", "A"],
    ["g1", "2", "Bob", "B"],
    ["g1", "3", "Cyd", "C"],
    ["g1", "5", "Eda", "E"],
  ])

  const roster = await db.roster.findFirstOrThrow({ where: { examId } })
  const slot = await db.slot.create({
    data: { examId, rosterId: roster.id, startsAt: inDays(1), endsAt: inDays(1, 10) },
  })
  await db.enrollment.create({ data: { examId, studentNumber: "3", slotId: slot.id } })

  const next = csv("1;Ala;Nowak;0", "2;Bob;B;1", "3;Cyd;C;1", "4;Dan;D;0")
  expect(await previewImport(examId, teacherId, "g1", next)).toMatchObject({
    ok: true,
    rosterId: roster.id,
    add: [{ studentNumber: "4" }],
    update: [{ studentNumber: "1", lastName: "Nowak" }],
    remove: [{ studentNumber: "2" }, { studentNumber: "3" }],
    withdrawnEnrolled: [{ studentNumber: "3", slotStartsAt: inDays(1) }],
    notInFile: [{ studentNumber: "5" }],
  })
  expect(await applyImport(examId, teacherId, "g1", next, [])).toEqual({
    ok: false,
    code: "IMPORT_PREVIEW_STALE",
  })
  expect(await people(examId)).toHaveLength(4)
  expect(await applyImport(examId, teacherId, "g1", next, ["3"])).toEqual({ ok: true })
  expect(await people(examId)).toEqual([
    ["g1", "1", "Ala", "Nowak"],
    ["g1", "4", "Dan", "D"],
    ["g1", "5", "Eda", "E"],
  ])
  expect(await db.enrollment.count({ where: { examId } })).toBe(0)
  expect(await db.roster.count({ where: { examId } })).toBe(1)
})

test("skreślony z zespołu traci zapis; druga osoba zostaje w slocie z odpowiedziami", async () => {
  const { examId, teacherId } = await createExam({
    maxTeamSize: 2,
    fields: [{ id: "t", label: "Temat", required: false }],
    rosters: { g1: { students: ["1", "2"], slots: [inDays(1)] } },
  })
  const enrolled = await enroll(examId, ["1", "2"], { t: "Robot" })
  if (!enrolled.ok) throw new Error(enrolled.code)

  expect(await applyImport(examId, teacherId, "g1", csv("1;A;A;0", "2;B;B;1"), ["2"])).toEqual({
    ok: true,
  })
  expect(await db.enrollment.findMany({ where: { examId } })).toMatchObject([
    { studentNumber: "1", slotId: enrolled.slotId, answers: { t: "Robot" } },
  ])
  expect((await people(examId)).map(([, n]) => n)).toEqual(["1"])
})

test("import nie przenosi osoby z innej listy i odrzuca plik bez wymaganych kolumn", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  expect(await previewImport(examId, teacherId, "g2", csv("1;X;Y;0", "5;E;E;0"))).toMatchObject({
    ok: true,
    rosterId: null,
    add: [{ studentNumber: "5" }],
    otherRoster: [{ studentNumber: "1" }],
  })
  expect(await applyImport(examId, teacherId, "g2", csv("1;X;Y;0", "5;E;E;0"), [])).toEqual({
    ok: true,
  })
  expect(await people(examId)).toEqual([
    ["g1", "1", "Imię1", "Nazwisko1"],
    ["g2", "5", "E", "E"],
  ])
  expect(await applyImport(examId, teacherId, "g2", "indeks;imie\n1;X", [])).toMatchObject({
    ok: false,
    code: "MISSING_COLUMNS",
  })
})

test("ręczne dodanie i usunięcie osoby", async () => {
  const { examId, teacherId, rosterIds } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1)] }, g2: { students: [], slots: [] } },
  })
  const person = { studentNumber: "7", firstName: "Ewa", lastName: "E" }
  expect(await addEntry(examId, teacherId, { ...person, rosterId: rosterIds.g2! })).toEqual({
    ok: true,
  })
  expect(await addEntry(examId, teacherId, { ...person, rosterId: rosterIds.g1! })).toEqual({
    ok: false,
    code: "ENTRY_EXISTS",
    rosterName: "g2",
  })
  expect(await people(examId)).toContainEqual(["g2", "7", "Ewa", "E"])

  const slot = await db.slot.findFirstOrThrow({ where: { examId } })
  await db.enrollment.create({ data: { examId, studentNumber: "1", slotId: slot.id } })
  expect(await deleteEntry(examId, teacherId, "1")).toEqual({
    ok: false,
    code: "ENTRY_HAS_ENROLLMENT",
  })
  expect(await deleteEntry(examId, teacherId, "7")).toEqual({ ok: true })
  expect(await people(examId)).toEqual([["g1", "1", "Imię1", "Nazwisko1"]])
})

test("ręczne dodanie bez list zakłada listę „lista”", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const person = { rosterId: "", studentNumber: "7", firstName: "Ewa", lastName: "E" }
  expect(await addEntry(examId, teacherId, person)).toEqual({ ok: true })
  expect(await people(examId)).toEqual([["lista", "7", "Ewa", "E"]])
})

test("ręczne dodanie do nieistniejącej listy albo bez wyboru przy kilku listach jest odrzucone", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { lista: { students: [], slots: [] }, g2: { students: [], slots: [] } },
  })
  const person = { studentNumber: "7", firstName: "Ewa", lastName: "E" }

  const foreign = await createExam({ rosters: { g1: { students: [], slots: [] } } })
  for (const rosterId of [randomUUID(), foreign.rosterIds.g1!]) {
    expect(await addEntry(examId, teacherId, { ...person, rosterId })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    })
  }
  expect(await addEntry(examId, teacherId, { ...person, rosterId: "" })).toEqual({
    ok: false,
    code: "ROSTER_NOT_CHOSEN",
  })
  expect(await db.roster.count({ where: { examId } })).toBe(2)
  expect(await people(examId)).toEqual([])
})

test("usunięcie listy: zablokowane, gdy ktoś z niej siedzi w slocie innej listy", async () => {
  const { examId, teacherId, rosterIds } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] }, g2: { students: ["2"], slots: [inDays(1)] } },
  })
  const g2Slot = await db.slot.findFirstOrThrow({ where: { examId } })
  await db.enrollment.create({ data: { examId, studentNumber: "1", slotId: g2Slot.id } })

  expect(await removeRoster(examId, teacherId, rosterIds.g1!)).toEqual({
    ok: false,
    code: "ROSTER_HAS_ENROLLMENTS",
  })
  expect(await removeRoster(examId, teacherId, rosterIds.g2!)).toEqual({
    ok: false,
    code: "ROSTER_HAS_ENROLLMENTS",
  })

  await db.enrollment.deleteMany({ where: { examId } })
  expect(await removeRoster(examId, teacherId, rosterIds.g1!)).toEqual({ ok: true })
  expect(await people(examId)).toEqual([["g2", "2", "Imię2", "Nazwisko2"]])
})

test("cudzy prowadzący dostaje NOT_FOUND i niczego nie zmienia", async () => {
  const { examId, rosterIds } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  const stranger = (await createExam({ rosters: {} })).teacherId
  const notFound = { ok: false, code: "NOT_FOUND" }

  expect(await previewImport(examId, stranger, "g1", csv("2;B;B;0"))).toEqual(notFound)
  expect(await applyImport(examId, stranger, "g1", csv("2;B;B;0"), [])).toEqual(notFound)
  expect(
    await addEntry(examId, stranger, {
      rosterId: rosterIds.g1!,
      studentNumber: "3",
      firstName: "C",
      lastName: "C",
    }),
  ).toEqual(notFound)
  expect(await deleteEntry(examId, stranger, "1")).toEqual(notFound)
  expect(await removeRoster(examId, stranger, rosterIds.g1!)).toEqual(notFound)
  expect(await people(examId)).toEqual([["g1", "1", "Imię1", "Nazwisko1"]])
})

test("podgląd importu nie czeka na blokadę zaliczenia (nie wstrzymuje zapisów)", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const locked = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const held = withExamLock(examId, "public", () => {
    locked.resolve()
    return released.promise
  })
  await locked.promise
  const timeout = new Promise((resolve) => setTimeout(() => resolve("czeka"), 1000))
  const preview = await Promise.race([
    previewImport(examId, teacherId, "g1", csv("1;A;A;0")),
    timeout,
  ])
  released.resolve()
  await held
  expect(preview).toMatchObject({ ok: true })
})

const withEmail = (...rows: string[]) => ["indeks;imie;nazwisko;email", ...rows].join("\n")

const emailOf = async (examId: string, studentNumber: string) =>
  (
    await db.rosterEntry.findUniqueOrThrow({
      where: { examId_studentNumber: { examId, studentNumber } },
    })
  ).email

test("import: adres z pliku małymi literami, domyślny bez kolumny, reimport nie nadpisuje pustym ani złym", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  await applyImport(
    examId,
    teacherId,
    "g1",
    withEmail("1;Ala;A;Ala@AGH.edu.pl", "2;Bob;B;", "3;Cyd;C;zly"),
    [],
  )
  expect(await emailOf(examId, "1")).toBe("ala@agh.edu.pl")
  expect(await emailOf(examId, "2")).toBe("2@student.agh.edu.pl")
  expect(await emailOf(examId, "3")).toBe("3@student.agh.edu.pl")

  const next = withEmail("1;Ala;A;inny@agh.edu.pl", "2;Bob;B;", "3;Cyd;C;zly")
  expect(await previewImport(examId, teacherId, "g1", next)).toMatchObject({
    badEmails: 1,
    update: [{ studentNumber: "1" }],
  })
  await applyImport(examId, teacherId, "g1", next, [])
  expect(await emailOf(examId, "1")).toBe("inny@agh.edu.pl")
  expect(await emailOf(examId, "3")).toBe("3@student.agh.edu.pl")
})

test("adres wpisu: dodanie z adresem i bez, zmiana, powrót do domyślnego; cudze zaliczenie nie widzi", async () => {
  const { examId, teacherId, rosterIds } = await createExam({
    rosters: { g1: { students: [], slots: [] } },
  })
  const person = { rosterId: rosterIds.g1!, firstName: "A", lastName: "B" }
  await addEntry(examId, teacherId, { ...person, studentNumber: "1", email: "a@agh.edu.pl" })
  await addEntry(examId, teacherId, { ...person, studentNumber: "2" })
  expect(await entryEmails(examId, teacherId)).toEqual({
    "1": "a@agh.edu.pl",
    "2": "2@student.agh.edu.pl",
  })
  expect(await setEntryEmail(examId, teacherId, "2", "b@agh.edu.pl")).toEqual({ ok: true })
  expect(await setEntryEmail(examId, teacherId, "1", "")).toEqual({ ok: true })
  expect(await entryEmails(examId, teacherId)).toEqual({
    "1": "1@student.agh.edu.pl",
    "2": "b@agh.edu.pl",
  })
  expect(await setEntryEmail(examId, teacherId, "9", "c@agh.edu.pl")).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
  const other = await createExam({ rosters: {} })
  expect(await entryEmails(examId, other.teacherId)).toBeNull()
  expect(await setEntryEmail(examId, other.teacherId, "1", "x@agh.edu.pl")).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
})

test("adres nie trafia do stanu zaliczenia ani do eksportu CSV", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  await setEntryEmail(examId, teacherId, "1", "tajny@agh.edu.pl")
  expect(JSON.stringify(await loadExam(examId))).not.toContain("tajny@agh.edu.pl")
  const exported = await examCsv(examId, teacherId)
  expect(JSON.stringify(exported)).not.toContain("tajny@agh.edu.pl")
})
