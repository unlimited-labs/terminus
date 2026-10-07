import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { DuplicateButton, ExportButton } from "@/components/exam-actions"
import { ExamForm } from "@/components/exam-form"
import { TeacherSection } from "@/components/teacher-section"
import { Button, buttonVariants } from "@/components/ui/button"
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
    <Button variant="outline" size="sm" onClick={copy} title={path}>
      Kopiuj link dla studentów
    </Button>
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

export function ExamSettings({ exam, userId }: { exam: ExamDetail; userId: string }) {
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const update = useResultMutation(updateExam, examChangeKeys(exam.id), () => {
    setEditing(false)
    toast.success("Zapisano zmiany.")
  })
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start gap-2">
        <div>
          <CardTitle className="text-2xl font-extrabold">
            <h1>{exam.name}</h1>
          </CardTitle>
          {!editing && exam.description && (
            <p className="whitespace-pre-line text-muted-foreground">{exam.description}</p>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Anuluj" : "Edytuj"}
          </Button>
          <ExportButton examId={exam.id} />
          <DuplicateButton examId={exam.id} />
          <DeleteExamButton
            exam={exam}
            deleteFn={deleteExam}
            invalidate={[examsQuery().queryKey]}
            onDeleted={() => void navigate({ to: "/" })}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <>
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
            <TeacherSection exam={exam} userId={userId} />
          </>
        ) : (
          <>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>Slot {exam.defaultSlotMinutes} min</span>
              <span>
                {exam.maxTeamSize === 1 ? "Indywidualnie" : `Zespoły do ${exam.maxTeamSize} os.`}
              </span>
              <span>
                {exam.enrollmentOpensAt
                  ? `Zapisy od ${formatDayTime(exam.enrollmentOpensAt)}`
                  : "Zapisy otwarte"}
              </span>
            </p>
            <CapacitySummary exam={exam} />
            <div className="flex flex-wrap gap-2">
              <Link
                to="/zaliczenia/$examId/tablica"
                params={{ examId: exam.id }}
                className={buttonVariants({ size: "sm" })}
              >
                Tablica zapisów
              </Link>
              <ExamLink examId={exam.id} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
