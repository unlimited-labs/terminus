import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { useExamMutation, useResultMutation } from "@/components/use-result-mutation"
import { addTeacherSchema } from "@/schemas/exam"
import type { ExamDetail } from "@/server/exam-state.server"
import { addExamTeacher, examsQuery, removeExamTeacher } from "@/server/exams"

export function TeacherSection({ exam, userId }: { exam: ExamDetail; userId: string }) {
  const navigate = useNavigate()
  const remove = useExamMutation(removeExamTeacher, exam.id)
  const leave = useResultMutation(
    removeExamTeacher,
    [examsQuery().queryKey],
    () => void navigate({ to: "/" }),
  )
  const last = exam.teachers.length === 1

  return (
    <SectionCard title="Prowadzący" contentClassName="grid gap-3">
      <ul className="grid gap-2">
        {exam.teachers.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{t.name}</span>
            <span className="text-muted-foreground">{t.email}</span>
            {t.id === userId && <Badge variant="secondary">Ty</Badge>}
            {t.banned && <Badge variant="destructive">zablokowane</Badge>}
            <span className="ml-auto">
              {t.id === userId ? (
                <ConfirmButton
                  title="Wypisać się z zaliczenia?"
                  description="Stracisz do niego dostęp. Przywrócić może cię inny prowadzący."
                  confirmLabel="Wypisz się"
                  disabled={last}
                  onConfirm={() => leave.mutateAsync({ examId: exam.id, teacherId: t.id })}
                >
                  Wypisz się
                </ConfirmButton>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => remove.mutate({ examId: exam.id, teacherId: t.id })}
                >
                  Usuń
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {last && (
        <p className="text-sm text-muted-foreground">
          Jedyny prowadzący nie może się wypisać — może usunąć zaliczenie.
        </p>
      )}
      <AddTeacherForm examId={exam.id} />
    </SectionCard>
  )
}

function AddTeacherForm({ examId }: { examId: string }) {
  const add = useExamMutation(addExamTeacher, examId, () => toast.success("Dodano prowadzącego."))
  const form = useAppForm({
    defaultValues: { examId, email: "" },
    ...schemaSubmit(addTeacherSchema, add.mutateAsync, { resetOnOk: true }),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
        <form.AppField name="email">
          {(f) => <f.TextField label="E-mail prowadzącego" type="email" autoComplete="off" />}
        </form.AppField>
        <div className="sm:self-end">
          <form.SubmitButton>Dodaj prowadzącego</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  )
}
