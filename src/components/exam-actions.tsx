import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useResultMutation } from "@/components/use-result-mutation"
import { errorMessage, UNEXPECTED_ERROR } from "@/messages.pl"
import { duplicateExamSchema } from "@/schemas/exam"
import { duplicateExam, exportExamCsv } from "@/server/exams"

export function ExportButton({ examId }: { examId: string }) {
  const download = useMutation({
    mutationFn: () => exportExamCsv({ data: { examId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(errorMessage(result))
        return
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }))
      const link = document.createElement("a")
      link.href = url
      link.download = result.fileName
      link.click()
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error(UNEXPECTED_ERROR),
  })
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={download.isPending}
      onClick={() => download.mutate()}
    >
      Eksport CSV
    </Button>
  )
}

export function DuplicateButton({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const duplicate = useResultMutation(duplicateExam, ["exams"], (result) => {
    setOpen(false)
    toast.success("Utworzono kopię zaliczenia.")
    void navigate({ to: "/zaliczenia/$examId", params: { examId: result.examId } })
  })
  const form = useAppForm({
    defaultValues: { examId, copyRosters: true },
    validators: { onSubmit: duplicateExamSchema },
    onSubmit: ({ value }) => duplicate.mutateAsync(duplicateExamSchema.parse(value)),
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
