import { useState } from "react"
import type { QueryKey } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const remove = useResultMutation(deleteFn, invalidate, () => {
    setOpen(false)
    onDeleted?.()
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" size={size} onClick={() => setOpen(true)}>
        Usuń
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usunąć zaliczenie?</DialogTitle>
          <DialogDescription>
            Znikną listy indeksów, sloty i wszystkie zapisy. Wpisz nazwę zaliczenia:{" "}
            <strong>{exam.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Nazwa zaliczenia"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={confirmName.trim() !== exam.name || remove.isPending}
            onClick={() => remove.mutate({ examId: exam.id, confirmName })}
          >
            Usuń na zawsze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
