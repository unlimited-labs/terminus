import { createFileRoute } from "@tanstack/react-router"

import { serveExamChanges } from "@/server/exam-access.server"

export const Route = createFileRoute("/api/exams/$examId/changes")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveExamChanges(request, params.examId),
    },
  },
})
