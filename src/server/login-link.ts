import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader, getRequestHeaders } from "@tanstack/react-start/server"
import { consola } from "consola"
import { z } from "zod"

import { examIdSchema } from "../schemas/exam.ts"
import { studentNumber } from "../schemas/roster.ts"

import { limitKey } from "./attempt-limit.server.ts"
import { auth } from "./auth.server.ts"
import { db } from "./db.server.ts"
import { requestLoginLink } from "./login-link.server.ts"

/** Zawsze `ok` (także nieznany indeks, limit, błąd poczty): odpowiedź nie jest wyrocznią listy. */
export const requestLink = createServerFn({ method: "POST" })
  .validator(examIdSchema.extend({ studentNumber }))
  .handler(async ({ data }) => {
    await requestLoginLink(data, limitKey(getRequestHeader("x-real-ip")))
    return { ok: true as const }
  })

/** Wejście z linku (POST ze strony wejścia, nie GET: skanery poczty otwierają linki i spaliłyby token). */
export const enterWithToken = createServerFn({ method: "POST" })
  .validator(examIdSchema.extend({ token: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const exam = await db.exam.findUnique({
      where: { id: data.examId },
      select: { requireEmailLogin: true },
    })
    if (!exam?.requireEmailLogin) return { ok: false as const }
    try {
      await auth.api.magicLinkVerify({
        query: { token: data.token },
        headers: getRequestHeaders(),
      })
      return { ok: true as const }
    } catch (e) {
      // Zużyty, wygasły albo błędny token kończy się przekierowaniem błędu wtyczki.
      consola.info(
        `link wejście odrzucone examId=${data.examId} ${e instanceof Error ? e.name : ""}`,
      )
      return { ok: false as const }
    }
  })
