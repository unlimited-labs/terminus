export type ExamField = { id: string; label: string; required: boolean }

export type Answers = Record<string, string>

export type AnswersCheck =
  | { ok: true; answers: Answers }
  | { ok: false; code: "MISSING_ANSWER"; labels: string[] }

/** Zostawia tylko odpowiedzi na pola zaliczenia (przycięte, niepuste). */
export function cleanAnswers(fields: ExamField[], raw: Answers): Answers {
  const answers: Answers = {}
  for (const field of fields) {
    const value = raw[field.id]?.trim()
    if (value) answers[field.id] = value
  }
  return answers
}

/** `cleanAnswers` + brak wymaganej odpowiedzi = błąd. */
export function checkAnswers(fields: ExamField[], raw: Answers): AnswersCheck {
  const answers = cleanAnswers(fields, raw)
  const missing = fields.filter((f) => f.required && !answers[f.id]).map((f) => f.label)
  return missing.length > 0
    ? { ok: false, code: "MISSING_ANSWER", labels: missing }
    : { ok: true, answers }
}

/** Wypełnione odpowiedzi z nazwami pól, w kolejności pól. */
export function filledAnswers(
  fields: ExamField[],
  answers: Answers,
): { label: string; value: string }[] {
  return fields.flatMap((f) => (answers[f.id] ? [{ label: f.label, value: answers[f.id]! }] : []))
}
