import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { copyExam, updateExamSettings } from "@/server/exam-ops.server"
import { enrollTeam } from "@/server/enrollment.server"

import { createExam, inDays } from "./fixtures"

test("duplikat kopiuje ustawienia i listy, bez slotów i zapisów; bez list na życzenie", async () => {
  const { examId, ownerId } = await createExam({
    maxTeamSize: 3,
    rosters: {
      g1: { students: ["1", "2"], slots: [inDays(1)] },
      g2: { students: ["3"], slots: [] },
    },
  })
  await enrollTeam(examId, ["1"])

  const copyId = (await copyExam(examId, ownerId, true))!
  const copy = await db.exam.findUniqueOrThrow({
    where: { id: copyId },
    include: { rosters: { include: { entries: true } }, enrollments: true },
  })
  expect(copy).toMatchObject({ name: "Kolokwium (kopia)", description: "Sala 1", maxTeamSize: 3 })
  expect(
    copy.rosters
      .map((r) => [r.name, r.entries.length])
      .toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["g1", 2],
    ["g2", 1],
  ])
  expect(copy.enrollments).toEqual([])
  expect(await db.slot.count({ where: { examId: copyId } })).toBe(0)

  const bare = (await copyExam(examId, ownerId, false))!
  expect(await db.roster.count({ where: { examId: bare } })).toBe(0)

  const stranger = await createExam({ rosters: {} })
  expect(await copyExam(examId, stranger.ownerId, true)).toBeNull()
})

test("edycja po starcie: zespół nie mniejszy niż największy istniejący; reszta zmienia się od razu", async () => {
  const { examId, ownerId } = await createExam({
    maxTeamSize: 3,
    rosters: { g1: { students: ["1", "2", "3"], slots: [inDays(1), inDays(2)] } },
  })
  await enrollTeam(examId, ["1", "2"])
  const settings = { name: "Nowa", description: "Sala 9", defaultSlotMinutes: 45 }

  expect(await updateExamSettings(examId, ownerId, { ...settings, maxTeamSize: 1 })).toMatchObject({
    ok: false,
    code: "TEAM_SIZE_BELOW_EXISTING",
  })
  expect(await updateExamSettings(examId, ownerId, { ...settings, maxTeamSize: 2 })).toEqual({
    ok: true,
  })
  expect(await db.exam.findUnique({ where: { id: examId } })).toMatchObject({
    ...settings,
    maxTeamSize: 2,
  })
  const slots = await db.slot.findMany({ where: { examId } })
  expect(slots.every((s) => s.endsAt.getTime() - s.startsAt.getTime() === 30 * 60_000)).toBe(true)
})
