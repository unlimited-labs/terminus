import { PencilIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useResultMutation } from "@/components/use-result-mutation"
import type { Answers, ExamField } from "@/domain/fields"
import { updateSlotAnswers } from "@/server/board"

export function SlotAnswers({
  examId,
  slotId,
  fields,
  answers,
}: {
  examId: string
  slotId: string
  fields: ExamField[]
  answers: Answers
}) {
  const [draft, setDraft] = useState<Answers | null>(null)
  const save = useResultMutation(updateSlotAnswers, ["exam", examId], () => {
    setDraft(null)
    toast.success("Zapisano odpowiedzi zespołu.")
  })
  // Stan mutacji dociera do komponentu asynchronicznie, a drugie kliknięcie bywa szybsze.
  const sending = useRef(false)
  const submit = (values: Answers) => {
    if (sending.current) return
    sending.current = true
    save.mutate(
      { examId, slotId, answers: values },
      {
        onSettled: () => {
          sending.current = false
        },
      },
    )
  }

  if (draft) {
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null)
      if (e.key === "Enter") submit(draft)
    }
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        {fields.map((f) => (
          <Input
            key={f.id}
            aria-label={f.label}
            placeholder={f.label}
            value={draft[f.id] ?? ""}
            onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
            onKeyDown={onKeyDown}
            className="h-7 w-48"
          />
        ))}
        <Button size="xs" disabled={save.isPending} onClick={() => submit(draft)}>
          Zapisz
        </Button>
      </div>
    )
  }
  const filled = fields.filter((f) => answers[f.id])
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
      {filled.map((f) => (
        <span key={f.id}>
          {f.label}: <span className="text-foreground">{answers[f.id]}</span>
        </span>
      ))}
      <button
        type="button"
        aria-label="Zmień odpowiedzi zespołu"
        onClick={() => setDraft({ ...answers })}
        className="rounded p-0.5 hover:text-foreground"
      >
        <PencilIcon className="size-3.5" />
      </button>
    </p>
  )
}
