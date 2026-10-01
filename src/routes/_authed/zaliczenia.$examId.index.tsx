import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { ExamSettings } from "@/components/exam-settings"
import { RosterSection } from "@/components/roster-section"
import { SlotSection } from "@/components/slot-section"
import { examQuery } from "@/server/exams"

export const Route = createFileRoute("/_authed/zaliczenia/$examId/")({
  loader: async ({ context, params }) => {
    const exam = await context.queryClient.query({
      ...examQuery(params.examId),
      staleTime: "static",
    })
    if (!exam) throw notFound()
    return { title: exam.name }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Zaliczenie"} — Terminus` }],
  }),
  component: ExamPage,
})

function ExamPage() {
  const { examId } = Route.useParams()
  const { data: exam } = useSuspenseQuery(examQuery(examId))
  if (!exam) return null
  return (
    <div className="grid gap-6">
      <ExamSettings exam={exam} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SlotSection exam={exam} />
        <RosterSection exam={exam} />
      </div>
    </div>
  )
}
