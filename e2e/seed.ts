import { warsawDateTime } from "../src/domain/time.ts"
import { warsawDay } from "../src/domain/time.ts"
import { defaultEmail } from "../src/domain/email.ts"
import { db } from "../src/server/db.server.ts"

import { dayOf, E2E, type E2EState } from "./config.ts"

const baseDay = warsawDay(new Date(Date.now() + 30 * 86_400_000))
const pad = (n: number) => String(n).padStart(2, "0")
const at = (day: number, hour: number, minute = 0) =>
  warsawDateTime(dayOf(baseDay, day), `${pad(hour)}:${pad(minute)}`)

async function createExam(
  name: string,
  maxTeamSize: number,
  students: [string, string, string][],
  slots: Date[],
  enrolled: [string, number][],
  enrollmentOpensAt: Date | null = null,
) {
  const teacher = await db.user.findUniqueOrThrow({ where: { email: E2E.admin.email } })
  const exam = await db.exam.create({
    data: {
      teachers: { connect: { id: teacher.id } },
      name,
      description: "Sala 1.23",
      defaultSlotMinutes: 20,
      maxTeamSize,
      enrollmentOpensAt,
    },
  })
  const roster = await db.roster.create({ data: { examId: exam.id, name: "g1" } })
  await db.rosterEntry.createMany({
    data: students.map(([studentNumber, firstName, lastName]) => ({
      examId: exam.id,
      rosterId: roster.id,
      studentNumber,
      firstName,
      lastName,
      email: defaultEmail(studentNumber),
    })),
  })
  const created = await db.slot.createManyAndReturn({
    data: slots.map((startsAt) => ({
      examId: exam.id,
      rosterId: roster.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 20 * 60_000),
    })),
  })
  created.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  await db.enrollment.createMany({
    data: enrolled.map(([studentNumber, slot]) => ({
      examId: exam.id,
      studentNumber,
      slotId: created[slot]!.id,
    })),
  })
  return exam.id
}

type Student = [string, string, string]

const BOARD: Student[] = [
  ["500001", "Anna", "Adamska"],
  ["500002", "Bartosz", "Bąk"],
  ["500003", "Celina", "Cis"],
]
const STUDENT: Student[] = [
  ["600001", "Ewa", "Ekiert"],
  ["600002", "Filip", "Fik"],
  ["600003", "Gosia", "Gil"],
]
const RACE: Student[] = [
  ["900001", "Kamil", "Kos"],
  ["900002", "Lena", "Lis"],
  ["900003", "Marek", "Mak"],
]

/** Zaliczenie zablokowanego prowadzącego (konto `zablokowany@e2e.test`), z jednym zapisem. */
async function blockedOwnerExam() {
  const id = await createExam(
    "Zablokowane E2E",
    1,
    [["970001", "Zofia", "Zet"]],
    [at(16, 9)],
    [["970001", 0]],
  )
  const teacher = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Zablokowany E2E",
      email: "zablokowany@e2e.test",
      banned: true,
    },
  })
  await db.exam.update({
    where: { id },
    data: { teachers: { set: [{ id: teacher.id }] } },
  })
  return id
}

/** Dwie listy: g1 (980001 z zapisem, 980002 bez) i g2 (980003). */
async function twoRostersExam() {
  const id = await createExam(
    "Dwie listy E2E",
    1,
    [
      ["980001", "Rafał", "Rak"],
      ["980002", "Sara", "Sowa"],
    ],
    [at(18, 9)],
    [["980001", 0]],
  )
  const g2 = await db.roster.create({ data: { examId: id, name: "g2" } })
  await db.rosterEntry.create({
    data: {
      examId: id,
      rosterId: g2.id,
      studentNumber: "980003",
      firstName: "Tomasz",
      lastName: "Tur",
      email: defaultEmail("980003"),
    },
  })
  return id
}

async function manualExam(name: string, mode: "RANDOM" | "MANUAL", students: Student[]) {
  const id = await createExam(name, 1, students, [at(20, 9), at(20, 9, 20)], [])
  await db.exam.update({ where: { id }, data: { assignmentMode: mode } })
  return id
}

/** Zaliczenie z adresami na liście; `requireEmailLogin` włączone, gdy `emailLogin`. */
async function emailLoginExam(name: string, emailLogin: boolean) {
  const id = await createExam(
    name,
    2,
    [
      ["710001", "Ola", "Ach"],
      ["710002", "Piotr", "Bok"],
      ["710003", "Zofia", "Cis"],
    ],
    [at(21, 9), at(21, 9, 20), at(21, 9, 40)],
    [],
  )
  await db.exam.update({ where: { id }, data: { requireEmailLogin: emailLogin } })
  for (const [studentNumber, email] of [
    ["710001", "ola@e2e.test"],
    ["710002", "piotr@e2e.test"],
    ["710003", "zofia@e2e.test"],
  ] as const) {
    await db.rosterEntry.update({
      where: { examId_studentNumber: { examId: id, studentNumber } },
      data: { email },
    })
  }
  return id
}

export async function seed(): Promise<E2EState> {
  const board = (
    enrolled: [string, number][] = [
      ["500001", 0],
      ["500002", 1],
    ],
  ) => createExam("Tablica E2E", 2, BOARD, [at(5, 9), at(5, 9, 20), at(5, 9, 40)], enrolled)
  const kolokwium = () => createExam("Kolokwium E2E", 2, STUDENT, [at(6, 10), at(6, 10, 20)], [])
  const slots = async () => {
    const id = await createExam(
      "Sloty E2E",
      1,
      [["950001", "Nina", "Nowak"]],
      [at(11, 9), at(11, 9, 20), at(11, 9, 40), at(12, 9)],
      [["950001", 0]],
    )
    await db.exam.update({
      where: { id },
      data: { fields: [{ id: "t", label: "Temat", required: false }] },
    })
    await db.enrollment.updateMany({ where: { examId: id }, data: { answers: { t: "Robot" } } })
    return id
  }
  const race = () =>
    createExam("Wyścig E2E", 1, RACE, [at(9, 9), at(9, 9, 20), at(10, 9, 40)], [["900003", 2]])

  const exams = {
    boardMouse: await board(),
    boardKeyboard: await board([
      ["500001", 1],
      ["500002", 0],
    ]),
    boardTeam: await board([["500001", 1]]),
    boardGrades: await board([
      ["500001", 0],
      ["500002", 0],
    ]),
    exportDuplicate: await board(),
    fields: await board(),
    student: await kolokwium(),
    rosters: await kolokwium(),
    full: await createExam(
      "Pełne E2E",
      1,
      [
        ["700001", "Hanna", "Hak"],
        ["700002", "Igor", "Iwan"],
      ],
      [at(7, 8)],
      [["700001", 0]],
    ),
    future: await createExam(
      "Przyszłe E2E",
      1,
      [["800001", "Jan", "Jutro"]],
      [at(8, 9)],
      [],
      at(1, 12),
    ),
    raceRename: await race(),
    raceDrag: await race(),
    slotsDelete: await slots(),
    slotsAnswers: await slots(),
    days: await createExam(
      "Plansza E2E",
      1,
      [
        ["960001", "Ola", "Olek"],
        ["960002", "Piotr", "Pal"],
      ],
      [at(13, 9), at(14, 9)],
      [["960001", 0]],
    ),
    doomed: await createExam("Usuwane E2E", 1, [], [], []),
    rename: await createExam("Stara nazwa E2E", 1, [], [], []),
    blockedOwner: await blockedOwnerExam(),
    withdrawn: await createExam(
      "Skreśleni E2E",
      1,
      [
        ["400001", "Anna", "Nowak"],
        ["400003", "Ewa", "Zając"],
      ],
      [at(17, 10)],
      [["400003", 0]],
    ),
    teachers: await createExam("Wspólne E2E", 1, [], [], []),
    rosterAdd: await twoRostersExam(),
    rosterDelete: await twoRostersExam(),
    slotsEdit: await createExam("Edycja slotów E2E", 1, [], [at(19, 9), at(19, 9, 20)], []),
    manual: await manualExam("Ręczny E2E", "MANUAL", [["990001", "Alicja", "Arbuz"]]),
    modeSwitch: await manualExam("Zmiana sposobu E2E", "RANDOM", [["990002", "Bogdan", "Burak"]]),
    emailLogin: await emailLoginExam("Logowanie mailem E2E", true),
    emailLoginSetup: await emailLoginExam("Ustawienie logowania E2E", false),
  }
  await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Druga Osoba E2E",
      email: "wspolprowadzacy@e2e.test",
    },
  })
  await db.$disconnect()
  return { baseDay, exams }
}
