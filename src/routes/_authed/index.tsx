import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { ExamForm } from "@/components/exam-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useResultMutation } from "@/components/use-result-mutation"
import { createExam, examsQuery } from "@/server/exams"

export const Route = createFileRoute("/_authed/")({
  loader: ({ context }) => context.queryClient.query({ ...examsQuery(), staleTime: "static" }),
  head: () => ({ meta: [{ title: "Moje zaliczenia — Zapisy" }] }),
  component: ExamList,
})

function ExamList() {
  const { data: exams } = useSuspenseQuery(examsQuery())
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const create = useResultMutation(createExam, ["exams"], ({ examId }) =>
    navigate({ to: "/zaliczenia/$examId", params: { examId } }),
  )

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-extrabold">Moje zaliczenia</h1>
        {!creating && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            Nowe zaliczenie
          </Button>
        )}
      </div>
      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>Nowe zaliczenie</CardTitle>
          </CardHeader>
          <CardContent>
            <ExamForm
              defaultValues={{
                name: "",
                description: "",
                defaultSlotMinutes: 15,
                maxTeamSize: 1,
                fields: [],
              }}
              submitLabel="Utwórz"
              onSubmit={create.mutateAsync}
            />
          </CardContent>
        </Card>
      )}
      {exams.length === 0 && !creating && (
        <p className="text-muted-foreground">Nie masz jeszcze żadnego zaliczenia.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {exams.map((exam) => {
          const entries = exam.rosters.reduce((n, r) => n + r._count.entries, 0)
          const slots = exam.rosters.reduce((n, r) => n + r._count.slots, 0)
          return (
            <li key={exam.id}>
              <Link to="/zaliczenia/$examId" params={{ examId: exam.id }}>
                <Card className="h-full transition hover:ring-primary">
                  <CardHeader>
                    <CardTitle>{exam.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-1 text-muted-foreground">
                    <p className="line-clamp-2">{exam.description}</p>
                    <p className="tabular-nums">
                      zapisani {exam._count.enrollments} / {entries} · sloty {slots}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
