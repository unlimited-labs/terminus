import { createFileRoute } from "@tanstack/react-router"

import { serveExamChanges } from "@/server/exam-access.server"

/** Sygnały zmian zaliczenia (SSE) dla otwartej strony prowadzącego albo studenta. */
export const Route = createFileRoute("/api/exams/$examId/changes")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveExamChanges(request, params.examId),
    },
  },
})
