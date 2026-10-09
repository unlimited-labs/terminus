import { useMutation, useQueryClient } from "@tanstack/react-query"

import { schemaSubmit, useAppForm } from "@/components/form"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Ticket } from "@/components/ticket"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { errorMessage, ownSlotMessage, UNEXPECTED_ERROR } from "@/messages.pl"
import { enrollmentSchema } from "@/schemas/enrollment"
import type { Answers, ExamField } from "@/domain/fields"
import type { Ticket as TicketData } from "@/server/enrollment.server"
import { enroll } from "@/server/enroll"
import { scheduleQuery } from "@/server/schedule"

type Outcome = Awaited<ReturnType<typeof enroll>>
type Failure = Extract<Outcome, { ok: false }>

export function EnrollSheet({
  examId,
  place,
  title,
  submitLabel,
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

function EnrollForm({
  examId,
  maxTeamSize,
  fields,
  submitLabel,
  onEnrolled,
}: {
  examId: string
  maxTeamSize: number
  fields: ExamField[]
  submitLabel: string
  onEnrolled: (slotId: string, ticket: TicketData) => void
}) {
  const team = maxTeamSize > 1
  const queryClient = useQueryClient()
  const draw = useMutation({
    mutationFn: async (input: { studentNumbers: string[]; answers: Answers }) => {
      const [outcome] = await Promise.all([
        enroll({ data: { examId, ...input } }),
        wait(MIN_DRAW_MS),
      ])
      return outcome
    },
    onSuccess: (outcome) => {
      if (outcome.ok) onEnrolled(outcome.slotId, outcome.ticket)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scheduleQuery(examId).queryKey }),
  })
  const form = useAppForm({
    defaultValues: {
      examId,
      studentNumbers: [""],
      answers: Object.fromEntries(fields.map((f) => [f.id, ""])),
    },
    ...schemaSubmit(enrollmentSchema, draw.mutateAsync),
    onSubmitInvalid: () => draw.reset(),
  })
  const failure = draw.data && !draw.data.ok ? draw.data : null
  const submitted = draw.variables?.studentNumbers.length ?? 0
  const flagged = new Set(failure ? flaggedNumbers(failure, submitted) : [])
  // Po odpowiedzi serwera formularz rysuje się od nowa — fokus na pierwszy wskazany indeks.
  const firstFlagged = draw.variables?.studentNumbers.findIndex((n) => flagged.has(n.trim())) ?? -1

  if (draw.isPending) {
    return (
      <p
        role="status"
        className="grid min-h-44 place-items-center rounded-xl border-2 border-dashed text-muted-foreground"
      >
        Losowanie slotu…
      </p>
    )
  }

  return (
    <form.AppForm>
      <form.Form className="grid gap-4">
        {failure && <FailureMessage failure={failure} submitted={submitted} />}
        {draw.isError && <Message tone="error">{UNEXPECTED_ERROR}</Message>}
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
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
        <PrivacyNotice />
      </form.Form>
    </form.AppForm>
  )
}

function flaggedNumbers(failure: Failure, submitted: number): string[] {
  if ("studentNumbers" in failure) return failure.studentNumbers
  if ("enrolled" in failure && submitted > 1) return failure.enrolled.map((e) => e.studentNumber)
  return []
}

function FailureMessage({ failure, submitted }: { failure: Failure; submitted: number }) {
  if (failure.code !== "ALREADY_ENROLLED")
    return <Message tone="error">{errorMessage(failure)}</Message>
  const [own] = failure.enrolled
  if (submitted === 1 && own) {
    return <Message tone="info">{ownSlotMessage(own.startsAt)}</Message>
  }
  return <Message tone="error">{errorMessage(failure)} Nikogo nie zapisano.</Message>
}

function Message({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className={`rounded-lg border-l-4 px-3 py-2 ${
        tone === "info" ? "border-free bg-free/10" : "border-destructive bg-destructive/10"
      }`}
    >
      {children}
    </div>
  )
}
