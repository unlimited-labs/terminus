import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

import { OPS } from "../messages.pl.ts"

const isTimeZone = (tz: string) => {
  try {
    return Boolean(new Intl.DateTimeFormat("pl", { timeZone: tz }))
  } catch {
    return false
  }
}

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    APP_PUBLIC_URL: z.url(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    TZ: z.string().refine(isTimeZone, OPS.unknownTimeZone).default("Europe/Warsaw"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
