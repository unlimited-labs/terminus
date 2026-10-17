import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      experimental: { tasks: true },
      // Uchwyt zadania nie jest rozwiązywany względem katalogu projektu: ścieżka bezwzględna.
      tasks: {
        "student:cleanup": {
          handler: fileURLToPath(new URL("./src/server/tasks/student-cleanup.ts", import.meta.url)),
        },
      },
      // 03:00 czasu procesu (Dockerfile ustawia TZ=Europe/Warsaw).
      scheduledTasks: { "0 3 * * *": ["student:cleanup"] },
    }),
    viteReact(),
  ],
})
