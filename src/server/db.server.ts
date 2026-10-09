import { PrismaPg } from "@prisma/adapter-pg"
import { consola } from "consola"

import { PrismaClient } from "../generated/prisma/client.ts"

import { env } from "./env.server.ts"

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: [
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
})

db.$on("warn", (e) => consola.warn("prisma", e.message))
db.$on("error", (e) => consola.error("prisma", e.message))
