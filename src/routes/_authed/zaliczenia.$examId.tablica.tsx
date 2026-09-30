import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"

import { EnrollmentBoard } from "@/components/enrollment-board"
import { examQuery } from "@/server/exams"

export const Route = createFileRoute("/_authed/zaliczenia/$examId/tablica")({
  loader: async ({ context, params }) => {
    const exam = await context.queryClient.query({
      ...examQuery(params.examId),
      staleTime: "static",
    })
    if (!exam) throw notFound()
    return { title: exam.name }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Tablica: ${loaderData?.title ?? "zaliczenie"} — Zapisy` }],
  }),
  component: BoardPage,
})

function BoardPage() {
  const { examId } = Route.useParams()
  const { data: exam } = useSuspenseQuery({ ...examQuery(examId), refetchInterval: 30_000 })
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
