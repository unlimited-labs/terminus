import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { DuplicateButton, ExportButton } from "@/components/exam-actions"
import { ExamForm } from "@/components/exam-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeleteExamButton } from "@/components/delete-exam-button"
import { useResultMutation } from "@/components/use-result-mutation"
import { formatDayTime, warsawDay, warsawTime } from "@/domain/time"
import type { ExamDetail } from "@/server/exam-state.server"
import { deleteExam, examChangeKeys, examsQuery, updateExam } from "@/server/exams"

function ExamLink({ examId }: { examId: string }) {
  const path = `/z/${examId}`
  const copy = async () => {
    const url = new URL(path, window.location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Skopiowano link.")
    } catch {
      toast.error(`Nie udało się skopiować. Link do skopiowania ręcznie: ${url}`)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-lg bg-muted px-2 py-1 text-sm break-all">{path}</code>
      <Button variant="outline" size="sm" onClick={copy}>
        Kopiuj link
      </Button>
    </div>
  )
}

export function CapacitySummary({ exam }: { exam: ExamDetail }) {
  const single = exam.rosters.length === 1
  return (
    <ul className="grid gap-1 text-sm">
      {exam.rosters.map((roster) => {
        const people = exam.people.filter((p) => p.rosterId === roster.id).length
        const places = exam.slots.filter((s) => s.rosterId === roster.id).length * exam.maxTeamSize
        return (
          <li key={roster.id} className={places < people ? "text-destructive" : undefined}>
            {single ? "" : `${roster.name}: `}
            <span className="tabular-nums">
              indeksy: {people}, miejsca w slotach: {places}
            </span>
            {places < people && " — za mało miejsc!"}
          </li>
        )
      })}
    </ul>
  )
}

export function ExamSettings({ exam }: { exam: ExamDetail }) {
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const update = useResultMutation(updateExam, examChangeKeys(exam.id), () => {
    setEditing(false)
    toast.success("Zapisano zmiany.")
  })
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-2">
        <CardTitle className="text-2xl font-extrabold">
          <h1>{exam.name}</h1>
        </CardTitle>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Anuluj" : "Edytuj"}
          </Button>
          <ExportButton examId={exam.id} />
          <DuplicateButton examId={exam.id} />
          <DeleteExamButton
            exam={exam}
            remove={deleteExam}
            invalidate={[examsQuery().queryKey]}
            onDeleted={() => void navigate({ to: "/" })}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {editing ? (
          <ExamForm
            defaultValues={{
              name: exam.name,
              description: exam.description,
              defaultSlotMinutes: exam.defaultSlotMinutes,
              maxTeamSize: exam.maxTeamSize,
              fields: exam.fields,
              opensDate: exam.enrollmentOpensAt ? warsawDay(exam.enrollmentOpensAt) : "",
              opensTime: exam.enrollmentOpensAt ? warsawTime(exam.enrollmentOpensAt) : "",
            }}
            submitLabel="Zapisz"
            onSubmit={(values) => update.mutateAsync({ examId: exam.id, ...values })}
          />
        ) : (
          <>
            <p className="whitespace-pre-line text-muted-foreground">{exam.description}</p>
            <p className="text-sm">
              Slot domyślnie {exam.defaultSlotMinutes} min ·{" "}
              {exam.maxTeamSize === 1
                ? "zaliczenie indywidualne"
                : `zespoły do ${exam.maxTeamSize} os.`}
            </p>
            <p className="text-sm">
              {exam.enrollmentOpensAt
                ? `Start zapisów: ${formatDayTime(exam.enrollmentOpensAt)}`
                : "Zapisy otwarte od utworzenia zaliczenia"}
            </p>
            {exam.fields.length > 0 && (
              <p className="text-sm">
                Pola dla studenta:{" "}
                {exam.fields
                  .map((f) => (f.required ? f.label : `${f.label} (opcjonalne)`))
                  .join(", ")}
              </p>
            )}
            <ExamLink examId={exam.id} />
            <Link
              to="/zaliczenia/$examId/tablica"
              params={{ examId: exam.id }}
              className="font-semibold text-primary"
            >
              Tablica zapisów →
            </Link>
            <CapacitySummary exam={exam} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
