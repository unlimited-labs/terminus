import { expect, test, vi } from "vitest"

import { db } from "@/server/db.server"
import { insertExam, updateExamSettings } from "@/server/exam-ops.server"
import { studentAccess } from "@/server/student-access.server"

import { createExam } from "./fixtures"

// Serwer bez poczty: SMTP nie jest ustawiony.
vi.mock("@/server/env.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/env.server")>()),
  emailLoginAvailable: false,
}))

const settings = {
  name: "Nowa",
  description: "",
  defaultSlotMinutes: 20,
  maxTeamSize: 1,
  assignmentMode: "RANDOM" as const,
  fields: [],
  opensDate: "",
  opensTime: "",
}

test("bez poczty nie da się utworzyć ani przełączyć zaliczenia na logowanie mailem", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const on = { ...settings, requireEmailLogin: true }
  expect(await insertExam(teacherId, on)).toEqual({ ok: false, code: "EMAIL_LOGIN_UNAVAILABLE" })
  expect(await updateExamSettings(examId, teacherId, on)).toEqual({
    ok: false,
    code: "EMAIL_LOGIN_UNAVAILABLE",
  })
  expect(await db.exam.findUniqueOrThrow({ where: { id: examId } })).toMatchObject({
    requireEmailLogin: false,
  })
})

test("opcja włączona, a poczta zniknęła: ustawienia da się zapisać, student widzi niedostępność", async () => {
  const { examId, teacherId } = await createExam({
    rosters: { g1: { students: ["1"], slots: [] } },
  })
  await db.exam.update({ where: { id: examId }, data: { requireEmailLogin: true } })
  expect(
    await updateExamSettings(examId, teacherId, { ...settings, requireEmailLogin: true }),
  ).toEqual({ ok: true })
  expect(await studentAccess(examId, "1@student.agh.edu.pl")).toEqual({ kind: "unavailable" })
  expect(
    await updateExamSettings(examId, teacherId, { ...settings, requireEmailLogin: false }),
  ).toEqual({ ok: true })
  expect(await studentAccess(examId, null)).toEqual({ kind: "open" })
})
