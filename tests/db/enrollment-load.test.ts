import { expect, test } from "vitest"

import { enrollTeam } from "@/server/enrollment.server"

import { createExam, inDays } from "./fixtures"

/** Pomiar ręczny: `LOAD=200 pnpm vitest run tests/db/enrollment-load.test.ts --silent=false`; wyniki w issue 06. */
const requests = Number(process.env.LOAD)

test.runIf(requests > 0)(
  `${requests} równoległych zapisów w chwili otwarcia`,
  async () => {
    for (const slotCount of [requests, 30]) {
      const students = Array.from({ length: 2 * requests }, (_, i) => String(100_000 + i))
      const { examId } = await createExam({
        rosters: {
          g1: {
            students,
            slots: Array.from({ length: slotCount }, (_, i) =>
              inDays(1 + Math.floor(i / 16), i % 16),
            ),
          },
        },
      })
      const started = performance.now()
      const results = await Promise.all(
        students.slice(0, requests).map(async (s) => {
          const t = performance.now()
          const outcome = await enrollTeam(examId, [s])
          return { code: outcome.ok ? "OK" : outcome.code, ms: performance.now() - t }
        }),
      )
      const total = performance.now() - started
      const ms = results.map((r) => r.ms).toSorted((a, b) => a - b)
      const at = (q: number) => Math.round(ms[Math.floor(q * (requests - 1))]!)
      const codes = Object.groupBy(results, (r) => r.code)
      console.info(
        `sloty=${slotCount} razem=${Math.round(total)}ms p50=${at(0.5)}ms p95=${at(0.95)}ms max=${at(1)}ms`,
        Object.fromEntries(Object.entries(codes).map(([k, v]) => [k, v!.length])),
      )
      expect(codes.BUSY).toBeUndefined()
    }
  },
  300_000,
)
