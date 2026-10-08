import { randomUUID } from "node:crypto"

import { expect, test } from "vitest"

import { listBlockedAccountExams } from "@/server/account-ops.server"
import { auth } from "@/server/auth.server"
import { db } from "@/server/db.server"
import { addTeacher, copyExam, removeExam, removeTeacher } from "@/server/exam-ops.server"
import { getOwnedExam } from "@/server/exam-access.server"

import { createExam } from "./fixtures"

const user = (banned = false) =>
  db.user.create({
    data: { id: randomUUID(), name: "Druga osoba", email: `${randomUUID()}@example.com`, banned },
  })

const teacherIds = async (examId: string) =>
  (
    await db.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { teachers: { select: { id: true } } },
    })
  ).teachers.map((t) => t.id)

test("prowadzący po mailu: pełny dostęp, usuwa nawet założyciela; ostatni zostaje", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const second = await user()
  const stranger = await user()

  expect(await getOwnedExam(examId, second.id)).toBeNull()
  expect(await addTeacher(examId, stranger.id, second.email)).toEqual({
    ok: false,
    code: "NOT_FOUND",
  })
  expect(await addTeacher(examId, teacherId, second.email.toUpperCase())).toEqual({ ok: true })
  expect(await addTeacher(examId, teacherId, second.email)).toEqual({
    ok: false,
    code: "ALREADY_TEACHER",
  })
  expect(await addTeacher(examId, teacherId, "nikt@example.com")).toEqual({
    ok: false,
    code: "TEACHER_NOT_FOUND",
  })
  expect(await addTeacher(examId, teacherId, (await user(true)).email)).toEqual({
    ok: false,
    code: "TEACHER_BANNED",
  })
  expect(await getOwnedExam(examId, second.id)).toMatchObject({ id: examId })

  expect(await removeTeacher(examId, second.id, teacherId)).toEqual({ ok: true })
  expect(await getOwnedExam(examId, teacherId)).toBeNull()
  expect(await removeTeacher(examId, second.id, second.id)).toEqual({
    ok: false,
    code: "LAST_TEACHER",
  })
  expect(await teacherIds(examId)).toEqual([second.id])
  expect(await removeExam(examId, { teacher: second.id }, "Kolokwium")).toEqual({ ok: true })
})

test("duplikat ma tylko duplikującego prowadzącego", async () => {
  const { examId, teacherId } = await createExam({ rosters: {} })
  const second = await user()
  await addTeacher(examId, teacherId, second.email)
  const copy = await copyExam(examId, second.id, false)
  if (!copy.ok) throw new Error(copy.code)
  expect(await teacherIds(copy.examId)).toEqual([second.id])
})

test("superadmin widzi zaliczenie zablokowanego dopiero, gdy zablokowani są wszyscy prowadzący", async () => {
  const email = `${randomUUID()}@example.com`
  await auth.api.createUser({ body: { email, password: "haslo-123456", name: "A", role: "admin" } })
  const res = await auth.api.signInEmail({
    body: { email, password: "haslo-123456" },
    returnHeaders: true,
  })
  const headers = new Headers({ cookie: res.headers.getSetCookie()[0]!.split(";")[0]! })

  const { examId, teacherId } = await createExam({ rosters: {} })
  const second = await user()
  await addTeacher(examId, teacherId, second.email)
  await db.user.update({ where: { id: teacherId }, data: { banned: true } })
  expect(await listBlockedAccountExams(headers, teacherId)).toEqual([])

  await db.user.update({ where: { id: second.id }, data: { banned: true } })
  expect(await listBlockedAccountExams(headers, teacherId)).toEqual([
    { id: examId, name: "Kolokwium", enrollments: 0 },
  ])
})
