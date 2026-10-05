import { db } from "../src/server/db.server.ts"

import { E2E, type E2EState } from "./config.ts"

const at = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2030, 9, day, hour - 2, minute))

async function createExam(
  ownerId: string,
  name: string,
  maxTeamSize: number,
  students: [string, string, string][],
  slots: Date[],
  enrolled: [string, number][],
  enrollmentOpensAt: Date | null = null,
) {
  const exam = await db.exam.create({
    data: {
      ownerId,
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

export async function seed(): Promise<E2EState> {
  const owner = await db.user.findUniqueOrThrow({ where: { email: E2E.admin.email } })
  const boardExamId = await createExam(
    owner.id,
    "Tablica E2E",
    2,
    [
      ["500001", "Anna", "Adamska"],
      ["500002", "Bartosz", "Bąk"],
      ["500003", "Celina", "Cis"],
    ],
    [at(5, 9), at(5, 9, 20), at(5, 9, 40)],
    [
      ["500001", 0],
      ["500002", 1],
    ],
  )
  const studentExamId = await createExam(
    owner.id,
    "Kolokwium E2E",
    2,
    [
      ["600001", "Ewa", "Ekiert"],
      ["600002", "Filip", "Fik"],
      ["600003", "Gosia", "Gil"],
    ],
    [at(6, 10), at(6, 10, 20)],
    [],
  )
  const fullExamId = await createExam(
    owner.id,
    "Pełne E2E",
    1,
    [
      ["700001", "Hanna", "Hak"],
      ["700002", "Igor", "Iwan"],
    ],
    [at(7, 8)],
    [["700001", 0]],
  )
  const futureExamId = await createExam(
    owner.id,
    "Przyszłe E2E",
    1,
    [["800001", "Jan", "Jutro"]],
    [at(8, 9)],
    [],
    at(1, 12),
  )
  const raceExamId = await createExam(
    owner.id,
    "Wyścig E2E",
    1,
    [
      ["900001", "Kamil", "Kos"],
      ["900002", "Lena", "Lis"],
      ["900003", "Marek", "Mak"],
    ],
    [at(9, 9), at(9, 9, 20), at(10, 9, 40)],
    [["900003", 2]],
  )
  const slotsExamId = await createExam(
    owner.id,
    "Sloty E2E",
    1,
    [["950001", "Nina", "Nowak"]],
    [at(11, 9), at(11, 9, 20), at(11, 9, 40), at(12, 9)],
    [["950001", 0]],
  )
  await db.exam.update({
    where: { id: slotsExamId },
    data: { fields: [{ id: "t", label: "Temat", required: false }] },
  })
  await db.enrollment.updateMany({
    where: { examId: slotsExamId },
    data: { answers: { t: "Robot" } },
  })
  const daysExamId = await createExam(
    owner.id,
    "Plansza E2E",
    1,
    [
      ["960001", "Ola", "Olek"],
      ["960002", "Piotr", "Pal"],
    ],
    [at(13, 9), at(14, 9)],
    [["960001", 0]],
  )
  const doomedExamId = await createExam(owner.id, "Usuwane E2E", 1, [], [], [])
  await db.$disconnect()
  return {
    boardExamId,
    studentExamId,
    fullExamId,
    futureExamId,
    raceExamId,
    slotsExamId,
    daysExamId,
    doomedExamId,
  }
}
