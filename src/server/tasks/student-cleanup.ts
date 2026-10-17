import { consola } from "consola"
import { defineTask } from "nitro/task"

import { cleanupStudents } from "../student-cleanup.server.ts"

export default defineTask({
  meta: { name: "student:cleanup", description: "Usuwa nieaktualne konta i sesje studentów" },
  run: async () => {
    const result = await cleanupStudents()
    consola.info(
      `sprzątanie studentów: sesje=${result.sessions} konta=${result.users} weryfikacje=${result.verifications}`,
    )
    return { result }
  },
})
