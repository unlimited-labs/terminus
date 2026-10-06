import { PencilIcon } from "lucide-react"
import { useState } from "react"
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
  const submit = (values: Answers) => save.mutate({ examId, slotId, answers: values })

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
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zmień odpowiedzi zespołu"
        onClick={() => setDraft({ ...answers })}
      >
        <PencilIcon className="size-3.5" />
      </Button>
    </p>
  )
}
