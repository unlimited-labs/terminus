import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { EnrollmentBoard, useBoardBusy } from "@/components/enrollment-board"
import { examQuery } from "@/server/exams"

import { loadExam } from "./-load-exam"

export const Route = createFileRoute("/_authed/zaliczenia/$examId/tablica")({
  loader: loadExam,
  head: ({ loaderData }) => ({
    meta: [{ title: `Tablica: ${loaderData?.title ?? "zaliczenie"} — Terminus` }],
  }),
  component: BoardPage,
})

function BoardPage() {
  const { examId } = Route.useParams()
  const mutating = useBoardBusy(examId)
  const { data: exam } = useSuspenseQuery({
    ...examQuery(examId),
    refetchInterval: mutating ? false : 30_000,
  })
  if (!exam) return null
  return (
    <div className="grid gap-3">
      <Link to="/zaliczenia/$examId" params={{ examId }} className="text-sm text-primary">
        ← Ustawienia, listy i sloty
      </Link>
      <EnrollmentBoard exam={exam} />
    </div>
  )
}
