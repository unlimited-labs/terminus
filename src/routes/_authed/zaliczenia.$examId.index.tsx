import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ExamSettings } from "@/components/exam-settings"
import { RosterSection } from "@/components/roster-section"
import { SlotSection } from "@/components/slot-section"
import { examQuery } from "@/server/exams"

import { loadExam } from "./-load-exam"

export const Route = createFileRoute("/_authed/zaliczenia/$examId/")({
  loader: loadExam,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Zaliczenie"} — Terminus` }],
  }),
  component: ExamPage,
})

function ExamPage() {
  const { examId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: exam } = useSuspenseQuery(examQuery(examId))
  if (!exam) return null
  return (
    <div className="grid gap-6">
      <ExamSettings exam={exam} userId={user.id} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SlotSection exam={exam} />
        <RosterSection exam={exam} />
      </div>
    </div>
  )
}
