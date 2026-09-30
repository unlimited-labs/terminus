import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../generated/prisma/client.ts"

import { env } from "./env.server.ts"

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
})
