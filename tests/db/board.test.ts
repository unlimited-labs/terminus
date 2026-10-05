import { describe, expect, test } from "vitest"

import type { BoardCommand } from "@/domain/board"
import { runBoardCommand } from "@/server/board-ops.server"
import { db } from "@/server/db.server"

import { createExam, enroll, inDays } from "./fixtures"

async function setup() {
  const fixture = await createExam({
    maxTeamSize: 2,
    rosters: {
      g1: { students: ["1", "2", "3", "4"], slots: [inDays(1), inDays(2), inDays(3)] },
      g2: { students: ["9"], slots: [inDays(4)] },
    },
  })
  const slots = await db.slot.findMany({
    where: { examId: fixture.examId },
    orderBy: { startsAt: "asc" },
  })
  const [s1, s2, s3, g2] = slots.map((s) => s.id)
  const run = (command: BoardCommand) => runBoardCommand(fixture.examId, fixture.ownerId, command)
  const slotOf = async (studentNumber: string) =>
    (
      await db.enrollment.findUnique({
        where: { examId_studentNumber: { examId: fixture.examId, studentNumber } },
      })
    )?.slotId ?? null
  return { ...fixture, s1: s1!, s2: s2!, s3: s3!, g2: g2!, run, slotOf }
}

describe("runBoardCommand", () => {
  test("ręczny zapis, przeniesienie, zamiana, zespół, usunięcie zapisu i Cofnij", async () => {
    const { s1, s2, s3, run, slotOf } = await setup()

    expect(await run({ kind: "move", studentNumber: "1", toSlotId: s1 })).toMatchObject({
      ok: true,
    })
    await run({ kind: "move", studentNumber: "2", toSlotId: s2 })

    const swap = await run({ kind: "swapPeople", a: "1", b: "2" })
    expect([await slotOf("1"), await slotOf("2")]).toEqual([s2, s1])
    if (!swap.ok) throw new Error(swap.code)
    await run(swap.inverse)
    expect([await slotOf("1"), await slotOf("2")]).toEqual([s1, s2])

    await run({ kind: "swapSlots", a: s1, b: s3 })
    expect(await slotOf("1")).toBe(s3)

    const removed = await run({ kind: "move", studentNumber: "1", toSlotId: null })
    expect(await slotOf("1")).toBeNull()
    if (!removed.ok) throw new Error(removed.code)
    await run(removed.inverse)
    expect(await slotOf("1")).toBe(s3)
  })

  test("pełny slot odrzucony; przeniesienie do slotu cudzej listy dozwolone", async () => {
    const { s1, g2, run } = await setup()
    await run({ kind: "move", studentNumber: "1", toSlotId: s1 })
    await run({ kind: "move", studentNumber: "2", toSlotId: s1 })
    expect(await run({ kind: "move", studentNumber: "3", toSlotId: s1 })).toEqual({
      ok: false,
      code: "SLOT_FULL",
    })
    expect(await run({ kind: "move", studentNumber: "1", toSlotId: g2 })).toMatchObject({
      ok: true,
    })
  })

  test("zmiana nazwiska zmienia wpis listy; cudze zaliczenie = nie znaleziono", async () => {
    const { examId, run } = await setup()
    await run({ kind: "rename", studentNumber: "4", firstName: "Ala", lastName: "Kot" })
    expect(
      await db.rosterEntry.findUnique({
        where: { examId_studentNumber: { examId, studentNumber: "4" } },
      }),
    ).toMatchObject({ firstName: "Ala", lastName: "Kot" })

    const other = await createExam({ rosters: {} })
    expect(
      await runBoardCommand(examId, other.ownerId, {
        kind: "move",
        studentNumber: "4",
        toSlotId: null,
      }),
    ).toEqual({ ok: false, code: "NOT_FOUND" })
  })

  // Jeden pusty slot na 2 osoby: bez blokady obie strony widzą go pustego i wstawiają razem 3 osoby.
  test("zapis zespołu i przeniesienie na tablicy równolegle nie przepełniają jedynego slotu", async () => {
    for (let round = 0; round < 10; round++) {
      const { examId, ownerId } = await createExam({
        maxTeamSize: 2,
        rosters: { g1: { students: ["1", "2", "3"], slots: [inDays(1)] } },
      })
      const slot = await db.slot.findFirstOrThrow({ where: { examId } })
      const results = await Promise.all([
        runBoardCommand(examId, ownerId, { kind: "move", studentNumber: "1", toSlotId: slot.id }),
        enroll(examId, ["2", "3"]),
      ])
      expect(results.filter((r) => r.ok)).toHaveLength(1)
      expect(await db.enrollment.count({ where: { examId } })).toBeLessThanOrEqual(2)
    }
  })
})
