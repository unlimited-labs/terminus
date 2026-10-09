import { consola } from "consola"
import { z } from "zod"

import { ACCESS_DENIED } from "../messages.pl.ts"

// Tylko identyfikatory: dane wejściowe niosą hasła, numery indeksów i całe listy CSV.
const ID_KEYS = ["id", "examId", "rosterId", "slotId", "toSlotId", "teacherId", "userId"]

function ids(data: unknown) {
  if (typeof data !== "object" || data === null) return ""
  const entries = Object.entries(data).filter(([k, v]) => ID_KEYS.includes(k) && v != null)
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(" ")
}

const seen = z.object({
  context: z
    .object({ user: z.object({ email: z.string() }) })
    .optional()
    .catch(undefined),
  result: z
    .object({ ok: z.literal(false), code: z.string() })
    .optional()
    .catch(undefined),
})

/** Jedna linia na wywołanie funkcji serwerowej: która, kto, na czym, wynik, czas. Odczyty na poziomie debug. */
export async function logCall<R>(
  call: { name: string; write: boolean; data: unknown },
  run: () => Promise<R>,
): Promise<R> {
  const start = performance.now()
  const line = (...parts: string[]) =>
    [call.name, ...parts, ids(call.data), `${Math.round(performance.now() - start)}ms`]
      .filter(Boolean)
      .join(" ")
  try {
    const res = await run()
    const { context, result } = seen.parse(res)
    const failed = result ? `odmowa:${result.code}` : ""
    consola[call.write ? "info" : "debug"](line(context?.user.email ?? "anonim", failed))
    return res
  } catch (e) {
    if (e instanceof Error && e.message === ACCESS_DENIED) consola.warn(line(ACCESS_DENIED))
    else consola.error(line("błąd"), e)
    throw e
  }
}
