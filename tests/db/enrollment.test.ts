import { describe, expect, test } from "vitest"

import { db } from "@/server/db.server"
import { enrollTeam } from "@/server/enrollment.server"
import { withExamLock } from "@/server/exam-lock.server"

import { createExam, inDays } from "./fixtures"

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
    const requests = [...teams, ...teams].map((team) => enrollTeam(examId, team))

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
    const result = await enrollTeam(examId, ["12", "11"])
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
    expect(await enrollTeam(examId, ["21", "22"])).toMatchObject({
      ok: false,
      code: "DIFFERENT_ROSTER",
    })
    expect(await enrollTeam(examId, ["21", "99"])).toMatchObject({
      ok: false,
      code: "NOT_ON_ROSTER",
    })
    expect(await db.enrollment.count({ where: { examId } })).toBe(0)
  })

  test("nieistniejące zaliczenie", async () => {
    expect(await enrollTeam("00000000-0000-4000-8000-000000000000", ["1"])).toEqual({
      ok: false,
      code: "NOT_FOUND",
    })
  })
})

test("przed startem zapisów zapis jest odrzucany, potem przechodzi", async () => {
  const { examId } = await createExam({
    rosters: { g1: { students: ["31"], slots: [inDays(3)] } },
  })
  const opensAt = new Date(Date.now() + 60 * 60_000)
  await db.exam.update({ where: { id: examId }, data: { enrollmentOpensAt: opensAt } })
  expect(await enrollTeam(examId, ["31"])).toEqual({ ok: false, code: "NOT_OPEN_YET", opensAt })
  expect(
    await enrollTeam(examId, ["31"], {}, { now: () => new Date(opensAt.getTime() + 1) }),
  ).toMatchObject({
    ok: true,
  })
})

/** Trzyma blokadę zaliczenia, dopóki test nie wywoła `release`. */
async function holdLock(examId: string) {
  const locked = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const done = withExamLock(examId, null, () => {
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
  const pending = enrollTeam(examId, ["41"], {}, { now: () => clock })
  await new Promise((resolve) => setTimeout(resolve, 200))
  clock = new Date(opensAt.getTime() + 2000)
  lock.release()
  await lock.done

  expect(await pending).toMatchObject({ ok: true })
})

test("przekroczenie czasu pod blokadą daje BUSY zamiast wyjątku", async () => {
  const { examId } = await createExam({ rosters: { g1: { students: ["51"], slots: [inDays(3)] } } })
  const lock = await holdLock(examId)
  const pending = enrollTeam(examId, ["51"], {}, { timeout: 300 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  lock.release()
  await lock.done

  expect(await pending).toEqual({ ok: false, code: "BUSY" })
  expect(await db.enrollment.count({ where: { examId } })).toBe(0)
})
