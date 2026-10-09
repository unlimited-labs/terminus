import { expect, test, vi } from "vitest"
import { z } from "zod"

import { schemaSubmit } from "./form"

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn<(message: string) => void>() }))
vi.mock("sonner", () => ({ toast: { error: toastError } }))

const schema = z.object({
  rosterId: z.string().min(1, "Wybierz listę."),
  n: z.string().transform(Number),
})

type Value = z.input<typeof schema>

const run = (
  submitOk: boolean,
  opts: { prepare?: (v: Value) => Value; resetOnOk?: boolean },
  value: Value = { rosterId: "g1", n: "2" },
) => {
  const submit = vi.fn<(data: unknown) => Promise<{ ok: boolean }>>(async () => ({ ok: submitOk }))
  const reset = vi.fn<() => void>()
  const { onSubmit } = schemaSubmit(schema, submit, opts)
  return { submit, reset, done: onSubmit({ value, formApi: { reset } }) }
}

test("błąd schematu po prepare: toast, bez wyjątku i bez wysyłki", async () => {
  const { submit, done } = run(true, { prepare: (v) => ({ ...v, rosterId: "" }) })
  await expect(done).resolves.toBeUndefined()
  expect(submit).not.toHaveBeenCalled()
  expect(toastError).toHaveBeenCalledWith("Wybierz listę.")
})

test("sukces: wysyła dane po parsowaniu", async () => {
  const { submit, done } = run(true, {})
  await done
  expect(submit).toHaveBeenCalledWith({ rosterId: "g1", n: 2 })
})

test("resetOnOk resetuje tylko przy ok", async () => {
  const ok = run(true, { resetOnOk: true })
  const failed = run(false, { resetOnOk: true })
  const noFlag = run(true, {})
  await Promise.all([ok.done, failed.done, noFlag.done])
  expect(ok.reset).toHaveBeenCalledOnce()
  expect(failed.reset).not.toHaveBeenCalled()
  expect(noFlag.reset).not.toHaveBeenCalled()
})
