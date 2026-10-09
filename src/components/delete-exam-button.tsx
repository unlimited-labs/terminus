import { useState } from "react"
import type { QueryKey } from "@tanstack/react-query"

import { ConfirmButton } from "@/components/confirm-button"
import { Input } from "@/components/ui/input"
import { useResultMutation } from "@/components/use-result-mutation"
import type { Result } from "@/messages.pl"

type DeleteInput = { examId: string; confirmName: string }

/** Usunięcie zaliczenia po przepisaniu jego nazwy (prowadzący albo superadmin przy zablokowanym koncie). */
export function DeleteExamButton({
  exam,
  deleteFn,
  invalidate,
  onDeleted,
  size = "sm",
}: {
  exam: { id: string; name: string }
  deleteFn: (opts: { data: DeleteInput }) => Promise<Result>
  invalidate: QueryKey[]
  onDeleted?: () => void
  size?: "sm" | "xs"
}) {
  const [confirmName, setConfirmName] = useState("")
  const remove = useResultMutation(deleteFn, invalidate, onDeleted)
  return (
    <ConfirmButton
      title="Usunąć zaliczenie?"
      description={
        <>
          Znikną listy indeksów, sloty i wszystkie zapisy. Wpisz nazwę zaliczenia:{" "}
          <strong>{exam.name}</strong>
        </>
      }
      body={
        <Input
          aria-label="Nazwa zaliczenia"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      }
      confirmLabel="Usuń na zawsze"
      confirmDisabled={confirmName.trim() !== exam.name}
      triggerVariant="destructive"
      triggerSize={size}
      onConfirm={async () => {
        const result = await remove.mutateAsync({ examId: exam.id, confirmName })
        // Dialog zostaje otwarty, gdy serwer odmówi (komunikat już w toaście).
        if (!result.ok) throw new Error(result.code)
      }}
    >
      Usuń
    </ConfirmButton>
  )
}
