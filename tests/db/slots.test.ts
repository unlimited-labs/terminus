import { randomUUID } from "node:crypto"

import { expect, test } from "vitest"

import { db } from "@/server/db.server"
import { addWindow, editSlot, removeFreeSlotsOfDay, removeSlot } from "@/server/slot-ops.server"

import { createExam, inDays } from "./fixtures"

const slotsOf = async (examId: string) =>
  db.slot.findMany({
    where: { examId },
    orderBy: { startsAt: "asc" },
    select: { id: true, rosterId: true, startsAt: true, endsAt: true },
  })

const enroll = (examId: string, studentNumber: string, slotId: string) =>
  db.enrollment.create({ data: { examId, studentNumber, slotId } })

test("okno tnie się na sloty w czasie polskim; nakładanie i cudza lista odrzucone", async () => {
  const { examId, ownerId, rosterIds } = await createExam({
    rosters: { g1: { students: [], slots: [] } },
  })
  const window = { rosterId: rosterIds.g1!, date: "2030-01-02", from: "10:00", to: "11:40" }

  expect(await addWindow(examId, ownerId, { ...window, minutes: 30 })).toEqual({
    ok: true,
    count: 3,
  })
  expect((await slotsOf(examId)).map((s) => [s.startsAt, s.endsAt])).toEqual([
    [inDays(1, 9), new Date("2030-01-02T09:30:00Z")],
    [new Date("2030-01-02T09:30:00Z"), inDays(1, 10)],
    [inDays(1, 10), new Date("2030-01-02T10:30:00Z")],
  ])

  expect(
    await addWindow(examId, ownerId, { ...window, from: "11:00", to: "12:00", minutes: 60 }),
  ).toEqual({
    ok: false,
    code: "SLOT_OVERLAP",
    startsAt: inDays(1, 10),
    endsAt: new Date("2030-01-02T10:30:00Z"),
  })
  expect(
    await addWindow(examId, ownerId, { ...window, rosterId: randomUUID(), minutes: 30 }),
  ).toEqual({ ok: false, code: "ROSTER_REQUIRED" })
  expect(await slotsOf(examId)).toHaveLength(3)
})

test("edycja slotu zmienia godziny i listę; nakładanie i zła kolejność odrzucone", async () => {
  const { examId, ownerId, rosterIds } = await createExam({
    rosters: {
      g1: { students: [], slots: [inDays(1), inDays(2)] },
      g2: { students: [], slots: [] },
    },
  })
  const [first, second] = await slotsOf(examId)
  const edit = { slotId: first!.id, rosterId: rosterIds.g2!, date: "2030-01-03" }

  expect(await editSlot(examId, ownerId, { ...edit, from: "10:15", to: "10:45" })).toEqual({
    ok: false,
    code: "SLOT_OVERLAP",
    startsAt: second!.startsAt,
    endsAt: second!.endsAt,
  })
  expect(await editSlot(examId, ownerId, { ...edit, from: "12:00", to: "11:00" })).toEqual({
    ok: false,
    code: "WINDOW_END_BEFORE_START",
  })
  expect(await editSlot(examId, ownerId, { ...edit, from: "09:00", to: "10:00" })).toEqual({
    ok: true,
  })
  expect((await slotsOf(examId))[0]).toEqual({
    id: first!.id,
    rosterId: rosterIds.g2,
    startsAt: inDays(2, 8),
    endsAt: inDays(2, 9),
  })
})

test("usunięcie slotu: wolny znika, z zapisem zostaje, cudzy daje NOT_FOUND", async () => {
  const { examId, ownerId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [inDays(1), inDays(2)] } },
  })
  const [free, taken] = await slotsOf(examId)
  await enroll(examId, "1", taken!.id)

  const other = await createExam({ rosters: { g1: { students: ["1"], slots: [inDays(3)] } } })
  const [foreign] = await slotsOf(other.examId)
  await enroll(other.examId, "1", foreign!.id)

  expect(await removeSlot(examId, ownerId, foreign!.id)).toEqual({ ok: false, code: "NOT_FOUND" })
  expect(await removeSlot(examId, ownerId, taken!.id)).toEqual({
    ok: false,
    code: "SLOT_HAS_ENROLLMENTS",
  })
  expect(await removeSlot(examId, ownerId, free!.id)).toEqual({ ok: true })
  expect((await slotsOf(examId)).map((s) => s.id)).toEqual([taken!.id])
  expect(await slotsOf(other.examId)).toHaveLength(1)
})

test("usunięcie wolnych slotów dnia liczy dzień w czasie polskim i omija zajęte", async () => {
  const { examId, ownerId } = await createExam({
    rosters: {
      g1: { students: ["1"], slots: [inDays(0, 23), inDays(1, 9), inDays(1, 12), inDays(2)] },
    },
  })
  const [, , noon, nextDay] = await slotsOf(examId)
  await enroll(examId, "1", noon!.id)

  expect(await removeFreeSlotsOfDay(examId, ownerId, "2030-01-02")).toEqual({
    ok: true,
    deleted: 2,
    skipped: 1,
  })
  expect((await slotsOf(examId)).map((s) => s.id)).toEqual([noon!.id, nextDay!.id])
})

test("cudzy prowadzący dostaje NOT_FOUND i niczego nie zmienia", async () => {
  const { examId, rosterIds } = await createExam({
    rosters: { g1: { students: [], slots: [inDays(1)] } },
  })
  const [slot] = await slotsOf(examId)
  const stranger = (await createExam({ rosters: {} })).ownerId
  const notFound = { ok: false, code: "NOT_FOUND" }
  const times = { rosterId: rosterIds.g1!, date: "2030-01-05", from: "10:00", to: "11:00" }

  expect(await addWindow(examId, stranger, { ...times, minutes: 30 })).toEqual(notFound)
  expect(await editSlot(examId, stranger, { ...times, slotId: slot!.id })).toEqual(notFound)
  expect(await removeSlot(examId, stranger, slot!.id)).toEqual(notFound)
  expect(await removeFreeSlotsOfDay(examId, stranger, "2030-01-02")).toEqual(notFound)
  expect(await slotsOf(examId)).toEqual([slot])
})
