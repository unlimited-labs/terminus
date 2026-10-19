import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import { toastUnexpected, useExamMutation } from "@/components/use-result-mutation"
import { suggestRosterName } from "@/domain/csv"
import { firstIssue } from "@/messages.pl"
import { rosterImportSchema } from "@/schemas/roster"
import { applyRosterImport, previewRosterImport } from "@/server/rosters"

export type ImportInput = z.input<typeof rosterImportSchema>
type Preview = Awaited<ReturnType<typeof previewRosterImport>>

/** Import listy z CSV: plik → podgląd na serwerze → zapis tego, co pokazał podgląd. */
export function useRosterImport(examId: string) {
  const [input, setInput] = useState<ImportInput | null>(null)
  // Ostatni podgląd zostaje na ekranie, gdy liczy się następny (mutacja zeruje data na czas żądania).
  const [shown, setShown] = useState<{ name: string; result: Preview } | null>(null)
  const preview = useMutation({
    mutationFn: (data: ImportInput) => previewRosterImport({ data }),
    onSuccess: (result, data) => setShown({ name: data.rosterName, result }),
    onError: toastUnexpected,
  })
  const checked = (data: ImportInput) => {
    const parsed = rosterImportSchema.safeParse(data)
    if (!parsed.success) toast.error(firstIssue(parsed.error))
    return parsed.success
  }
  const saving = useExamMutation(applyRosterImport, examId, () => {
    setInput(null)
    setShown(null)
    toast.success("Zaimportowano listę.")
  })

  const load = async (file: File) => {
    // accept= nie obowiązuje przy upuszczaniu ani przy „Wszystkie pliki” w oknie wyboru
    if (!file.name.toLowerCase().endsWith(".csv")) return void toast.error("Wybierz plik CSV.")
    const next = { examId, rosterName: suggestRosterName(file.name), csv: await file.text() }
    setInput(next)
    setShown(null)
    if (checked(next)) preview.mutate(next)
  }
  /** Nazwa listy liczy się dopiero tu: zmieniona dostaje świeży podgląd przed zapisem. */
  const apply = async () => {
    if (!input || !shown?.result.ok) return
    let plan = shown.result
    if (input.rosterName !== shown.name) {
      if (!checked(input)) return
      const next = await preview.mutateAsync(input).catch(() => null)
      // Inna lista docelowa to inny plan importu: zostaje na ekranie do ponownego zatwierdzenia.
      if (!next?.ok || next.rosterId !== plan.rosterId) return
      plan = next
    }
    const withdrawnEnrolled = plan.withdrawnEnrolled.map((e) => e.studentNumber)
    const done = await saving.mutateAsync({ ...input, withdrawnEnrolled })
    if (!done.ok && done.code === "IMPORT_PREVIEW_STALE") preview.mutate(input)
  }
  const saveDisabled = saving.isPending || preview.isPending
  return { input, setInput, load, result: shown?.result, apply, saveDisabled }
}
