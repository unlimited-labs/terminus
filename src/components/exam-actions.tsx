import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { schemaSubmit, useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useResultMutation } from "@/components/use-result-mutation"
import { duplicateExamSchema } from "@/schemas/exam"
import { duplicateExam, examsQuery, exportExamCsv } from "@/server/exams"

export function ExportButton({ examId }: { examId: string }) {
  const download = useResultMutation(exportExamCsv, [], (result) => {
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = result.fileName
    link.click()
    URL.revokeObjectURL(url)
  })
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={download.isPending}
      onClick={() => download.mutate({ examId })}
    >
      Eksport CSV
    </Button>
  )
}

export function DuplicateButton({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const duplicate = useResultMutation(duplicateExam, [examsQuery().queryKey], (result) => {
    setOpen(false)
    toast.success("Utworzono kopię zaliczenia.")
    void navigate({ to: "/zaliczenia/$examId", params: { examId: result.examId } })
  })
  const form = useAppForm({
    defaultValues: { examId, copyRosters: true },
    ...schemaSubmit(duplicateExamSchema, duplicate.mutateAsync),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Duplikuj
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplikuj zaliczenie</DialogTitle>
          <DialogDescription>
            Nowe zaliczenie z tymi samymi ustawieniami, bez slotów i zapisów (np. poprawka).
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form className="grid gap-4">
            <form.AppField name="copyRosters">
              {(f) => <f.CheckboxField label="Kopiuj listy indeksów" />}
            </form.AppField>
            <form.SubmitButton>Utwórz kopię</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
