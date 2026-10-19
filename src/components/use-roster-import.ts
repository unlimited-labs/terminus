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

/** Podgląd trzeba odświeżyć, gdy zmieniona nazwa listy nie jest pusta. */
export const needsPreview = (input: ImportInput | null, previewedName: string | undefined) =>
  Boolean(input?.rosterName.trim()) && input?.rosterName !== previewedName

/** Import listy z CSV: plik → podgląd na serwerze → zapis tego, co pokazał podgląd. */
export function useRosterImport(examId: string) {
  const [input, setInput] = useState<ImportInput | null>(null)
  const preview = useMutation({
    mutationFn: (data: ImportInput) => previewRosterImport({ data }),
    onError: toastUnexpected,
  })
  const previewChecked = (data: ImportInput) => {
    const parsed = rosterImportSchema.safeParse(data)
    if (parsed.success) preview.mutate(data)
    else toast.error(firstIssue(parsed.error))
  }
  const saving = useExamMutation(applyRosterImport, examId, () => {
    setInput(null)
    preview.reset()
    toast.success("Zaimportowano listę.")
  })

  const load = async (file: File) => {
    // accept= nie obowiązuje przy upuszczaniu ani przy „Wszystkie pliki” w oknie wyboru
    if (!file.name.toLowerCase().endsWith(".csv")) return void toast.error("Wybierz plik CSV.")
    const next = { examId, rosterName: suggestRosterName(file.name), csv: await file.text() }
    setInput(next)
    previewChecked(next)
  }
  const previewedName = preview.variables?.rosterName
  const refresh = () => {
    if (input && needsPreview(input, previewedName)) previewChecked(input)
  }
  const apply = async (withdrawnEnrolled: string[]) => {
    if (!input) return
    const done = await saving.mutateAsync({ ...input, withdrawnEnrolled })
    if (!done.ok && done.code === "IMPORT_PREVIEW_STALE") preview.mutate(input)
  }
  const saveDisabled = saving.isPending || preview.isPending || input?.rosterName !== previewedName
  return { input, setInput, load, refresh, preview, apply, saveDisabled }
}
