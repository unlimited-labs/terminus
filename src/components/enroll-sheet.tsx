import { useMutation, useQueryClient } from "@tanstack/react-query"

import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Ticket } from "@/components/ticket"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { failureNotice, UNEXPECTED_ERROR, type Result } from "@/messages.pl"
import { enrollmentFormSchema } from "@/schemas/enrollment"
import type { AssignmentMode } from "@/domain/draw"
import type { Answers, ExamField } from "@/domain/fields"
import type { Ticket as TicketData } from "@/server/enrollment.server"
import { enroll } from "@/server/enroll"
import { scheduleQuery } from "@/server/schedule"

export type PickedSlot = { id: string; label: string }

export function EnrollSheet({
  examId,
  place,
  title,
  submitLabel,
  assignmentMode,
  choosing,
  picked,
  maxTeamSize,
  fields,
  open,
  onOpenChange,
  ticket,
  onEnrolled,
  onShowOnBoard,
}: {
  examId: string
  place: string
  title: string
  submitLabel: string
  assignmentMode: AssignmentMode
  choosing: boolean
  picked: PickedSlot | null
  maxTeamSize: number
  fields: ExamField[]
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: TicketData | null
  onEnrolled: (slotId: string, ticket: TicketData) => void
  onShowOnBoard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[88svh] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-b-none p-5 text-base sm:max-w-none data-open:zoom-in-100 data-open:slide-in-from-bottom-10">
        <div className="mx-auto grid w-full max-w-xl gap-4">
          <DialogTitle className="text-xl font-extrabold">{title}</DialogTitle>
          {ticket ? (
            <>
              <Ticket ticket={ticket} place={place} />
              <Button size="lg" onClick={onShowOnBoard}>
                Pokaż na planszy
              </Button>
            </>
          ) : (
            <EnrollForm
              examId={examId}
              assignmentMode={assignmentMode}
              choosing={choosing}
              picked={picked}
              maxTeamSize={maxTeamSize}
              fields={fields}
              submitLabel={submitLabel}
              onEnrolled={onEnrolled}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const MIN_DRAW_MS = 700
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function enrollRequest(
  examId: string,
  input: { studentNumbers: string[]; answers: Answers },
  assignmentMode: AssignmentMode,
  picked: PickedSlot | null,
) {
  return assignmentMode === "MANUAL"
    ? { examId, ...input, assignmentMode, slotId: picked?.id }
    : { examId, ...input, assignmentMode }
}

function PickedNotice({ picked }: { picked: PickedSlot | null }) {
  return (
    <p className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3">
      {picked ? (
        <>
          Wybrany slot: <b className="tabular-nums">{picked.label}</b>
        </>
      ) : (
        "Nie wybrano slotu. Zamknij panel i kliknij wolny slot na planszy."
      )}
    </p>
  )
}

function useDraw(
  examId: string,
  assignmentMode: AssignmentMode,
  picked: PickedSlot | null,
  onEnrolled: (slotId: string, ticket: TicketData) => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { studentNumbers: string[]; answers: Answers }) => {
      const request = enrollRequest(examId, input, assignmentMode, picked)
      const [outcome] = await Promise.all([
        enroll({ data: request }),
        assignmentMode === "RANDOM" ? wait(MIN_DRAW_MS) : undefined,
      ])
      return outcome
    },
    onSuccess: (outcome) => {
      if (outcome.ok) onEnrolled(outcome.slotId, outcome.ticket)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scheduleQuery(examId).queryKey }),
  })
}

const PENDING_TEXT = { RANDOM: "Losowanie slotu…", MANUAL: "Zapisywanie…" }

function outcomeNotice(outcome: Result | undefined, studentNumbers: string[] = []) {
  return outcome && !outcome.ok ? failureNotice(outcome, studentNumbers) : null
}

function PendingStatus({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="grid min-h-44 place-items-center rounded-xl border-2 border-dashed text-muted-foreground"
    >
      {text}
    </p>
  )
}

function EnrollForm({
  examId,
  assignmentMode,
  choosing,
  picked,
  maxTeamSize,
  fields,
  submitLabel,
  onEnrolled,
}: {
  examId: string
  assignmentMode: AssignmentMode
  choosing: boolean
  picked: PickedSlot | null
  maxTeamSize: number
  fields: ExamField[]
  submitLabel: string
  onEnrolled: (slotId: string, ticket: TicketData) => void
}) {
  const team = maxTeamSize > 1
  const draw = useDraw(examId, assignmentMode, picked, onEnrolled)
  const form = useAppForm({
    defaultValues: {
      examId,
      studentNumbers: [""],
      answers: Object.fromEntries(fields.map((f) => [f.id, ""])),
    },
    ...schemaSubmit(enrollmentFormSchema, draw.mutateAsync),
    onSubmitInvalid: () => draw.reset(),
  })
  const notice = outcomeNotice(draw.data, draw.variables?.studentNumbers)
  const flagged = new Set(notice?.flagged)
  // Po odpowiedzi serwera formularz rysuje się od nowa — fokus na pierwszy wskazany indeks.
  const firstFlagged = draw.variables?.studentNumbers.findIndex((n) => flagged.has(n)) ?? -1

  if (draw.isPending) return <PendingStatus text={PENDING_TEXT[assignmentMode]} />

  return (
    <form.AppForm>
      <form.Form className="grid gap-4">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        {choosing && <PickedNotice picked={picked} />}
        {draw.isError && <Notice tone="error">{UNEXPECTED_ERROR}</Notice>}
        <form.Field name="studentNumbers" mode="array">
          {(list) => (
            <div className="grid gap-3">
              {list.state.value.map((_, i) => (
                <form.AppField key={i} name={`studentNumbers[${i}]`}>
                  {(field) => (
                    <field.TextField
                      label={team ? `Osoba ${i + 1} — numer indeksu` : "Numer indeksu"}
                      inputMode="numeric"
                      autoComplete="off"
                      className="h-11 text-lg tabular-nums"
                      invalid={flagged.has(field.state.value.trim())}
                      autoFocus={i === firstFlagged}
                      action={
                        i > 0 && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => list.removeValue(i)}
                          >
                            Usuń
                          </Button>
                        )
                      }
                    />
                  )}
                </form.AppField>
              ))}
              {team && list.state.value.length < maxTeamSize && (
                <Button type="button" variant="outline" onClick={() => list.pushValue("")}>
                  Dodaj osobę do zespołu ({list.state.value.length}/{maxTeamSize})
                </Button>
              )}
            </div>
          )}
        </form.Field>
        {fields.map((f) => (
          <form.AppField key={f.id} name={`answers.${f.id}`}>
            {(field) => (
              <field.TextField label={f.required ? f.label : `${f.label} (opcjonalnie)`} />
            )}
          </form.AppField>
        ))}
        <form.SubmitButton disabled={choosing && !picked}>{submitLabel}</form.SubmitButton>
        <PrivacyNotice />
      </form.Form>
    </form.AppForm>
  )
}
