import { randomUUID } from "node:crypto"

import { db } from "@/server/db"

type ExamFixture = {
  maxTeamSize?: number
  rosters: Record<string, { students: string[]; slots: Date[] }>
}

/** Zaliczenie z listami, wpisami i slotami (każdy slot 30 min); zwraca identyfikatory. */
export async function createExam({ maxTeamSize = 1, rosters }: ExamFixture) {
  const owner = await db.user.create({
    data: { id: randomUUID(), name: "Prowadzący", email: `${randomUUID()}@example.com` },
  })
  const exam = await db.exam.create({
    data: {
      ownerId: owner.id,
      name: "Kolokwium",
      description: "Sala 1",
      defaultSlotMinutes: 30,
      maxTeamSize,
    },
  })
  const rosterIds: Record<string, string> = {}
  for (const [name, { students, slots }] of Object.entries(rosters)) {
    const roster = await db.roster.create({ data: { examId: exam.id, name } })
    rosterIds[name] = roster.id
    await db.rosterEntry.createMany({
      data: students.map((studentNumber) => ({
        examId: exam.id,
        rosterId: roster.id,
        studentNumber,
        firstName: `Imię${studentNumber}`,
        lastName: `Nazwisko${studentNumber}`,
      })),
    })
    await db.slot.createMany({
      data: slots.map((startsAt) => ({
        examId: exam.id,
        rosterId: roster.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      })),
    })
  }
  return { examId: exam.id, ownerId: owner.id, rosterIds }
}

export const inDays = (days: number, hour = 9) => new Date(Date.UTC(2030, 0, 1 + days, hour))
