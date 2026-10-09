import { PencilIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cleanAnswers, filledAnswers, type Answers, type ExamField } from "@/domain/fields"

export function SlotAnswers({
  fields,
  answers,
  onSave,
}: {
  fields: ExamField[]
  answers: Answers
  /** `false` = odrzucone od razu; szkic zostaje otwarty. */
  onSave: (answers: Answers) => boolean
}) {
  const [draft, setDraft] = useState<Answers | null>(null)
  const submit = (values: Answers) => {
    if (onSave(cleanAnswers(fields, values))) setDraft(null)
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
        <Button size="xs" onClick={() => submit(draft)}>
          Zapisz
        </Button>
      </div>
    )
  }
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
      {filledAnswers(fields, answers).map((a) => (
        <span key={a.label}>
          {a.label}: <span className="text-foreground">{a.value}</span>
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
