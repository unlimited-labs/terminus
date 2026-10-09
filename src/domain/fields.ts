export type ExamField = { id: string; label: string; required: boolean }

export type Answers = Record<string, string>

export type AnswersCheck =
  | { ok: true; answers: Answers }
  | { ok: false; code: "MISSING_ANSWER"; labels: string[] }

/** Poprawka prowadzącego: czyszczenie jak przy zapisie, bez sprawdzania wymaganych pól. */
export function teacherAnswers(fields: ExamField[], raw: Answers): Answers {
  const cleaned = checkAnswers(
    fields.map((f) => ({ ...f, required: false })),
    raw,
  )
  return cleaned.ok ? cleaned.answers : {}
}

/** Zostawia tylko odpowiedzi na pola zaliczenia (przycięte, niepuste); brak wymaganej = błąd. */
export function checkAnswers(fields: ExamField[], raw: Answers): AnswersCheck {
  const answers: Answers = {}
  for (const field of fields) {
    const value = raw[field.id]?.trim()
    if (value) answers[field.id] = value
  }
  const missing = fields.filter((f) => f.required && !answers[f.id]).map((f) => f.label)
  return missing.length > 0
    ? { ok: false, code: "MISSING_ANSWER", labels: missing }
    : { ok: true, answers }
}
