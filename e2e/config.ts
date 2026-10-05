import { z } from "zod"

export const E2E = {
  port: 3100,
  baseURL: "http://localhost:3100",
  admin: { email: "admin@e2e.test", password: "haslo-admina-e2e", name: "Admin E2E" },
}

export const STATE_FILE = "e2e/.state.json"

export const e2eStateSchema = z.object({
  boardExamId: z.uuid(),
  studentExamId: z.uuid(),
  fullExamId: z.uuid(),
  futureExamId: z.uuid(),
  raceExamId: z.uuid(),
  slotsExamId: z.uuid(),
})

export type E2EState = z.infer<typeof e2eStateSchema>
