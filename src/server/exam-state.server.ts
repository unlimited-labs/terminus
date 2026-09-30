import { db } from "./db.server.ts"

/** Pełny stan zaliczenia: ustawienia, listy, wpisy (z zapisem) i sloty. */
export async function loadExam(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      owner: { select: { name: true } },
      rosters: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      enrollments: { select: { studentNumber: true, slotId: true } },
    },
  })
  if (!exam) return null
  const [entries, slots] = await Promise.all([
    db.rosterEntry.findMany({
      where: { examId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { studentNumber: true, firstName: true, lastName: true, rosterId: true },
    }),
    db.slot.findMany({
      where: { examId },
      orderBy: { startsAt: "asc" },
      select: { id: true, rosterId: true, startsAt: true, endsAt: true },
    }),
  ])
  const slotOf = new Map(exam.enrollments.map((e) => [e.studentNumber, e.slotId]))
  return {
    id: exam.id,
    name: exam.name,
    description: exam.description,
    ownerName: exam.owner.name,
    defaultSlotMinutes: exam.defaultSlotMinutes,
    maxTeamSize: exam.maxTeamSize,
    rosters: exam.rosters,
    slots,
    people: entries.map((e) => ({ ...e, slotId: slotOf.get(e.studentNumber) ?? null })),
  }
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof loadExam>>>
