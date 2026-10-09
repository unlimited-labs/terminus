import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"

import { DuplicateButton, ExportButton } from "@/components/exam-actions"
import { ExamForm } from "@/components/exam-form"
import { Button, buttonVariants } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { DeleteExamButton } from "@/components/delete-exam-button"
import { useExamMutation } from "@/components/use-result-mutation"
import { examCounts } from "@/domain/schedule"
import { warsawDay, warsawTime } from "@/domain/time"
import { phaseStatus } from "@/messages.pl"
import type { ExamDetail } from "@/server/exam-state.server"
import { deleteExam, examQuery, examsQuery, updateExam } from "@/server/exams"

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
    <Button variant="secondary" onClick={copy} title={path}>
      Kopiuj link dla studentów
    </Button>
  )
}

export function ExamHeader({ exam }: { exam: ExamDetail }) {
  const { enrolled, freeSlots } = examCounts(exam, exam.now)
  return (
    <header className="flex flex-wrap items-start gap-4 rounded-2xl bg-primary p-6 text-primary-foreground">
      <div className="grid gap-1">
        <p className="text-sm opacity-80">{phaseStatus(exam.phase, exam.enrollmentOpensAt)}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{exam.name}</h1>
        <p className="opacity-90 tabular-nums">
          {exam.people.length
            ? `${enrolled} z ${exam.people.length} zapisanych, wolnych slotów ${freeSlots}`
            : "Brak listy indeksów"}
        </p>
        {exam.description && (
          <p className="max-w-prose whitespace-pre-line text-sm opacity-80">{exam.description}</p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Link
          to="/zaliczenia/$examId/tablica"
          params={{ examId: exam.id }}
          className={buttonVariants({ variant: "secondary" })}
        >
          Tablica zapisów
        </Link>
        <ExamLink examId={exam.id} />
      </div>
    </header>
  )
}

/** Najpierw nawigacja, potem usunięcie z cache: odwrotnie zamontowana strona pobrałaby je od nowa i mignęło 404. */
export function useLeaveExam(examId: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return () =>
    void navigate({ to: "/" }).then(() =>
      queryClient.removeQueries({ queryKey: examQuery(examId).queryKey }),
    )
}

export function ExamActions({ exam }: { exam: ExamDetail }) {
  const leaveExam = useLeaveExam(exam.id)
  return (
    <div className="flex flex-wrap gap-2">
      <ExportButton examId={exam.id} />
      <DuplicateButton examId={exam.id} />
      <DeleteExamButton
        exam={exam}
        deleteFn={deleteExam}
        invalidate={[examsQuery().queryKey]}
        onDeleted={leaveExam}
      />
    </div>
  )
}

export function ExamSettingsForm({ exam }: { exam: ExamDetail }) {
  const router = useRouter()
  const update = useExamMutation(updateExam, exam.id, () => {
    toast.success("Zapisano zmiany.")
    void router.invalidate() // tytuł karty z loadera
  })
  return (
    <SectionCard title="Ustawienia">
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
    </SectionCard>
  )
}
