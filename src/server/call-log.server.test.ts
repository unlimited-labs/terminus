import { consola } from "consola"
import { expect, test, vi } from "vitest"

import { ACCESS_DENIED } from "../messages.pl.ts"

import { logCall } from "./call-log.server"

const call = { name: "deleteExam", write: true, data: { examId: "e1", password: "tajne" } }

test("zapis: kto, identyfikatory, bez reszty danych", async () => {
  const info = vi.spyOn(consola, "info").mockImplementation(() => {})
  await logCall(call, async () => ({
    context: { user: { email: "a@b.pl" } },
    result: { ok: true },
  }))
  const line = String(info.mock.calls[0]?.[0])
  expect(line).toMatch(/^deleteExam a@b\.pl examId=e1 \d+ms$/)
  expect(line).not.toContain("tajne")
})

test("wynik ok:false trafia do logu z kodem", async () => {
  const info = vi.spyOn(consola, "info").mockImplementation(() => {})
  await logCall(call, async () => ({ context: {}, result: { ok: false, code: "NOT_ON_ROSTER" } }))
  expect(String(info.mock.calls.at(-1)?.[0])).toContain("anonim odmowa:NOT_ON_ROSTER")
})

test("brak dostępu to warn bez stosu, inny wyjątek to error; oba lecą dalej", async () => {
  const warn = vi.spyOn(consola, "warn").mockImplementation(() => {})
  const error = vi.spyOn(consola, "error").mockImplementation(() => {})
  await expect(logCall(call, () => Promise.reject(new Error(ACCESS_DENIED)))).rejects.toThrow(
    ACCESS_DENIED,
  )
  expect(warn).toHaveBeenCalledOnce()
  expect(error).not.toHaveBeenCalled()
  await expect(logCall(call, () => Promise.reject(new Error("db padła")))).rejects.toThrow(
    "db padła",
  )
  expect(error).toHaveBeenCalledOnce()
})
