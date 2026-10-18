import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { z } from "zod"

import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { PrivacyNotice } from "@/components/privacy-notice"
import { StickyAction, StudentPage } from "@/components/student-page"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { STUDENT_LOGIN as T, UNEXPECTED_ERROR } from "@/messages.pl"
import { studentNumber } from "@/schemas/roster"
import { requestLink } from "@/server/login-link"

const RESEND_SECONDS = 60
const SKELETON_ROWS = 6

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])
  return [left, () => setLeft(seconds)] as const
}

function LoginForm({ examId }: { examId: string }) {
  const [sent, setSent] = useState(false)
  const [wait, startWait] = useCountdown(RESEND_SECONDS)
  const send = useMutation({
    mutationFn: (number: string) => requestLink({ data: { examId, studentNumber: number } }),
    onSuccess: () => {
      setSent(true)
      startWait()
    },
    onError: (error) => console.error(error),
  })
  const form = useAppForm({
    defaultValues: { studentNumber: "" },
    ...schemaSubmit(z.object({ studentNumber }), (data) => send.mutateAsync(data.studentNumber)),
  })

  if (sent) {
    return (
      <div className="grid gap-3" role="status">
        <h2 className="text-lg font-bold">{T.sentTitle}</h2>
        <p>{T.sent(send.variables!)}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={wait > 0 || send.isPending}
            onClick={() => send.mutate(send.variables!)}
          >
            {wait > 0 ? T.resendIn(wait) : T.resend}
          </Button>
          <Button variant="ghost" onClick={() => setSent(false)}>
            {T.changeIndex}
          </Button>
        </div>
      </div>
    )
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">{T.lead}</p>
      <PrivacyNotice emailLogin />
      <form.AppForm>
        <form.Form className="grid gap-2">
          <form.AppField name="studentNumber">
            {(f) => <f.TextField label={T.indexLabel} inputMode="numeric" autoComplete="off" />}
          </form.AppField>
          {send.isError && <p className="text-sm text-destructive">{UNEXPECTED_ERROR}</p>}
          <form.Subscribe selector={(s) => s.values.studentNumber.trim() === ""}>
            {(empty) => (
              <form.SubmitButton size="lg" disabled={empty || send.isPending}>
                {T.send}
              </form.SubmitButton>
            )}
          </form.Subscribe>
        </form.Form>
      </form.AppForm>
    </>
  )
}

/**
 * Zaliczenie z logowaniem mailem bez sesji: nagłówek, zamazany szkic harmonogramu bez żadnych danych
 * i okno logowania. `notice` (link albo sesja wygasły) otwiera okno od razu.
 */
export function StudentGate({
  examId,
  name,
  unavailable,
  notice,
}: {
  examId: string
  name: string
  unavailable: boolean
  notice?: string
}) {
  const [open, setOpen] = useState(notice !== undefined)
  return (
    <StudentPage title={name}>
      <Notice tone={unavailable ? "error" : "info"} role="status">
        {unavailable ? T.unavailable : T.prompt}
      </Notice>
      <div aria-hidden className="grid gap-2 blur-sm select-none">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-12 rounded-lg border bg-card" />
        ))}
      </div>
      {!unavailable && <StickyAction onClick={() => setOpen(true)}>{T.open}</StickyAction>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle>{T.open}</DialogTitle>
          {notice && (
            <Notice tone="notice" role="status">
              {notice}
            </Notice>
          )}
          <LoginForm examId={examId} />
        </DialogContent>
      </Dialog>
    </StudentPage>
  )
}
