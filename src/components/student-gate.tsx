import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Notice } from "@/components/notice"
import { PrivacyNotice } from "@/components/privacy-notice"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { STUDENT_LOGIN as T, UNEXPECTED_ERROR } from "@/messages.pl"
import { studentNumber } from "@/schemas/roster"
import { requestLink } from "@/server/login-link"

const RESEND_SECONDS = 60
const SKELETON_ROWS = 6

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])
  return [left, () => setLeft(seconds)] as const
}

function LoginForm({ examId }: { examId: string }) {
  const [index, setIndex] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, startWait] = useCountdown(RESEND_SECONDS)
  const send = useMutation({
    mutationFn: (number: string) => requestLink({ data: { examId, studentNumber: number } }),
    onSuccess: () => {
      setSent(true)
      startWait()
    },
    onError: () => setError(UNEXPECTED_ERROR),
  })
  const submit = () => {
    const parsed = studentNumber.safeParse(index)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? UNEXPECTED_ERROR)
      return
    }
    setError(null)
    send.mutate(parsed.data)
  }

  if (sent) {
    return (
      <div className="grid gap-3" role="status">
        <h2 className="text-lg font-bold">{T.sentTitle}</h2>
        <p>{T.sent(index.trim())}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={wait > 0 || send.isPending} onClick={submit}>
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
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Label htmlFor="login-index">{T.indexLabel}</Label>
        <Input
          id="login-index"
          inputMode="numeric"
          autoComplete="off"
          value={index}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-index-error" : undefined}
          onChange={(e) => setIndex(e.target.value)}
        />
        {error && (
          <p id="login-index-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button size="lg" disabled={send.isPending || index.trim() === ""}>
          {T.send}
        </Button>
      </form>
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
    <div className="mx-auto grid max-w-3xl gap-5 px-4 pt-6 pb-28 text-[17px]">
      <header>
        <h1 className="text-2xl leading-tight font-extrabold">{name}</h1>
      </header>
      <Notice tone={unavailable ? "error" : "info"} role="status">
        {unavailable ? T.unavailable : T.prompt}
      </Notice>
      <div aria-hidden className="grid gap-2 blur-sm select-none">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-12 rounded-lg border bg-card" />
        ))}
      </div>
      {!unavailable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
          <Button size="lg" className="mx-auto flex w-full max-w-xl" onClick={() => setOpen(true)}>
            {T.open}
          </Button>
        </div>
      )}
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
    </div>
  )
}
