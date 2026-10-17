import { describe, expect, test } from "vitest"

import { db } from "@/server/db.server"
import { withExamLock } from "@/server/exam-access.server"

import { createExam, enroll, inDays, TEST_NOW } from "./fixtures"

const numbers = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => String(from + i))

describe("enrollTeam", () => {
  test("50 równoległych zapisów na 5 slotów: dokładnie 5 zespołów, bez przepełnienia i podwójnych zapisów", async () => {
    const students = numbers(1000, 50)
    const { examId } = await createExam({
      maxTeamSize: 2,
      rosters: { g1: { students, slots: [1, 2, 3, 4, 5].map((d) => inDays(d)) } },
    })
    const teams = Array.from({ length: 25 }, (_, i) => [students[2 * i]!, students[2 * i + 1]!])
    const requests = [...teams, ...teams].map((team) => enroll(examId, team))

    const results = await Promise.all(requests)

    expect(results.filter((r) => r.ok)).toHaveLength(5)
    expect(
      results.every((r) => r.ok || r.code === "NO_FREE_SLOTS" || r.code === "ALREADY_ENROLLED"),
    ).toBe(true)
    const perSlot = await db.enrollment.groupBy({ by: ["slotId"], where: { examId }, _count: true })
    expect(perSlot).toHaveLength(5)
    expect(perSlot.every((s) => s._count === 2)).toBe(true)
  })

  test("zapis zwraca bilet ze składem zespołu; minione sloty nie są losowane", async () => {
    const { examId } = await createExam({
      maxTeamSize: 2,
      rosters: {
        g1: { students: ["11", "12"], slots: [new Date("2020-01-01T09:00:00Z"), inDays(3)] },
      },
    })
    const result = await enroll(examId, ["12", "11"])
    expect(result).toMatchObject({
      ok: true,
      ticket: {
        startsAt: inDays(3),
        team: [
          { studentNumber: "11", firstName: "Imię11", lastName: "Nazwisko11" },
          { studentNumber: "12", firstName: "Imię12", lastName: "Nazwisko12" },
        ],
      },
    })
  })

  test("odrzucony zapis niczego nie zapisuje", async () => {
    const { examId } = await createExam({
      maxTeamSize: 2,
      rosters: {
        g1: { students: ["21"], slots: [inDays(1)] },
        g2: { students: ["22"], slots: [inDays(2)] },
      },
    })
    expect(await enroll(examId, ["21", "22"])).toMatchObject({
      ok: false,
      code: "DIFFERENT_ROSTER",
    })
    expect(await enroll(examId, ["21", "99"])).toMatchObject({
      ok: false,
      code: "NOT_ON_ROSTER",
    })
    expect(await db.enrollment.count({ where: { examId } })).toBe(0)
  })

  test("nieistniejące zaliczenie", async () => {
    expect(await enroll("00000000-0000-4000-8000-000000000000", ["1"])).toEqual({
      ok: false,
      code: "NOT_FOUND",
    })
  })
})

test("przed startem zapisów zapis jest odrzucany, potem przechodzi", async () => {
  const { examId } = await createExam({
    rosters: { g1: { students: ["31"], slots: [inDays(3)] } },
  })
  const opensAt = new Date(TEST_NOW.getTime() + 60 * 60_000)
  await db.exam.update({ where: { id: examId }, data: { enrollmentOpensAt: opensAt } })
  expect(await enroll(examId, ["31"])).toEqual({ ok: false, code: "NOT_OPEN_YET", opensAt })
  expect(
    await enroll(examId, ["31"], {}, { now: () => new Date(opensAt.getTime() + 1) }),
  ).toMatchObject({
    ok: true,
  })
})

/** Trzyma blokadę zaliczenia, dopóki test nie wywoła `release`. */
async function holdLock(examId: string) {
  const locked = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const done = withExamLock(examId, "public", () => {
    locked.resolve()
    return released.promise
  })
  await locked.promise
  return { release: released.resolve, done }
}

test("„teraz” liczy się po uzyskaniu blokady: kto czekał przez moment otwarcia, zostaje przyjęty", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["41"], slots: [inDays(3)] } } })
  const opensAt = new Date("2030-01-01T09:00:00Z")
  await db.exam.update({ where: { id: examId }, data: { enrollmentOpensAt: opensAt } })

  let clock = new Date(opensAt.getTime() - 500)
  const lock = await holdLock(examId)
  const pending = enroll(examId, ["41"], {}, { now: () => clock })
  await new Promise((resolve) => setTimeout(resolve, 200))
  clock = new Date(opensAt.getTime() + 2000)
  lock.release()
  await lock.done

  expect(await pending).toMatchObject({ ok: true })
})

test("przekroczenie czasu pod blokadą daje BUSY zamiast wyjątku", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["51"], slots: [inDays(3)] } } })
  const lock = await holdLock(examId)
  const pending = enroll(examId, ["51"], {}, { timeout: 300 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  lock.release()
  await lock.done

  expect(await pending).toEqual({ ok: false, code: "BUSY" })
  expect(await db.enrollment.count({ where: { examId } })).toBe(0)
})

const slotsOf = async (examId: string) =>
  (await db.slot.findMany({ where: { examId }, orderBy: { startsAt: "asc" } })).map((x) => x.id)

describe("enrollTeam: ręczny wybór slotu", () => {
  test("zapis ląduje w wybranym slocie, nie w losowym", async () => {
    const { examId } = await createExam({
      assignmentMode: "MANUAL",
      rosters: { g1: { students: ["51"], slots: [inDays(1), inDays(2), inDays(3)] } },
    })
    const [, second] = await slotsOf(examId)
    const result = await enroll(examId, ["51"], {}, { shownMode: "MANUAL", slotId: second })
    expect(result).toMatchObject({ ok: true, slotId: second, ticket: { startsAt: inDays(2) } })
  })

  test("dwa zespoły na ten sam slot: jeden przyjęty, drugi dostaje SLOT_UNAVAILABLE i nic nie zapisuje", async () => {
    const { examId } = await createExam({
      assignmentMode: "MANUAL",
      rosters: { g1: { students: ["61", "62"], slots: [inDays(1), inDays(2)] } },
    })
    const [slotId] = await slotsOf(examId)
    const options = { shownMode: "MANUAL", slotId } as const

    const results = await Promise.all([
      enroll(examId, ["61"], {}, options),
      enroll(examId, ["62"], {}, options),
    ])

    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" })
    expect(await db.enrollment.count({ where: { examId } })).toBe(1)
  })

  test("slot innej listy, cudzy slot i brak wyboru nic nie zapisują", async () => {
    const other = await createExam({
      assignmentMode: "MANUAL",
      rosters: { g1: { students: ["1"], slots: [inDays(1)] } },
    })
    const { examId, rosterIds } = await createExam({
      assignmentMode: "MANUAL",
      rosters: {
        g1: { students: ["71"], slots: [inDays(1)] },
        g2: { students: ["72"], slots: [inDays(2)] },
      },
    })
    const g2Slot = (await db.slot.findFirstOrThrow({ where: { rosterId: rosterIds.g2 } })).id
    const foreignSlot = (await db.slot.findFirstOrThrow({ where: { examId: other.examId } })).id

    expect(await enroll(examId, ["71"], {}, { shownMode: "MANUAL", slotId: g2Slot })).toMatchObject(
      { ok: false, code: "SLOT_OTHER_ROSTER", teamRosterId: rosterIds.g1 },
    )
    expect(await enroll(examId, ["71"], {}, { shownMode: "MANUAL", slotId: foreignSlot })).toEqual({
      ok: false,
      code: "SLOT_UNAVAILABLE",
    })
    expect(await enroll(examId, ["71"], {}, { shownMode: "MANUAL" })).toMatchObject({
      ok: false,
      code: "NO_FREE_SLOTS",
    })
    expect(await db.enrollment.count({ where: { examId } })).toBe(0)
  })

  test("strona ze starym sposobem dostaje MODE_CHANGED w obie strony, bez zapisu", async () => {
    const manual = await createExam({
      assignmentMode: "MANUAL",
      rosters: { g1: { students: ["81"], slots: [inDays(1)] } },
    })
    expect(await enroll(manual.examId, ["81"])).toEqual({
      ok: false,
      code: "MODE_CHANGED",
      assignmentMode: "MANUAL",
    })
    const random = await createExam({ rosters: { g1: { students: ["82"], slots: [inDays(1)] } } })
    const [slotId] = await slotsOf(random.examId)
    expect(await enroll(random.examId, ["82"], {}, { shownMode: "MANUAL", slotId })).toEqual({
      ok: false,
      code: "MODE_CHANGED",
      assignmentMode: "RANDOM",
    })
    expect(
      await db.enrollment.count({ where: { examId: { in: [manual.examId, random.examId] } } }),
    ).toBe(0)
  })

  test("zmiana sposobu nie rusza istniejących zapisów", async () => {
    const { examId } = await createExam({
      rosters: { g1: { students: ["91", "92"], slots: [inDays(1), inDays(2)] } },
    })
    const first = await enroll(examId, ["91"])
    await db.exam.update({ where: { id: examId }, data: { assignmentMode: "MANUAL" } })
    const before = await db.enrollment.findMany({ where: { examId } })
    const free = (await slotsOf(examId)).find((id) => id !== (first.ok ? first.slotId : ""))!
    expect(await enroll(examId, ["92"], {}, { shownMode: "MANUAL", slotId: free })).toMatchObject({
      ok: true,
      slotId: free,
    })
    expect(await db.enrollment.findMany({ where: { examId, studentNumber: "91" } })).toEqual(before)
  })
})
