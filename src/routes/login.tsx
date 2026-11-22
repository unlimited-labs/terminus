import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { KeyRound } from "lucide-react"
import { useState } from "react"

import { submitThenChange, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { TicketCard } from "@/components/ticket-card"
import { CodeInput } from "@/components/code-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authFailure } from "@/lib/auth-client"
import { teacherAuthClient as authClient } from "@/lib/teacher-auth-client"
import { authErrorMessage } from "@/messages.pl"
import { loginSchema, loginSearchSchema } from "@/schemas/auth"
import { mailAvailable } from "@/server/password-link"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.query(sessionQuery())) throw redirect({ to: "/" })
  },
  loader: () => mailAvailable(),
  head: () => ({ meta: [{ title: "Logowanie — Terminus" }] }),
  component: Login,
})

function Login() {
  const { redirect: target, haslo } = Route.useSearch()
  const navigate = useNavigate()
  const { queryClient } = Route.useRouteContext()
  const [step, setStep] = useState<"password" | "code">("password")
  const enter = async () => {
    // Po wygaśnięciu sesji w tej karcie może się zalogować ktoś inny; klucze zapytań nie zawierają użytkownika.
    queryClient.clear()
    await navigate({ href: target ?? "/" })
  }
  return step === "code" ? (
    <CodeStep onDone={enter} onRestart={() => setStep("password")} />
  ) : (
    <PasswordStep notice={haslo} onDone={enter} onCode={() => setStep("code")} />
  )
}

function PasswordStep({
  notice,
  onDone,
  onCode,
}: {
  notice: "ustawione" | undefined
  onDone: () => Promise<void>
  onCode: () => void
}) {
  const canResetPassword = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    ...submitThenChange(loginSchema),
    onSubmit: async ({ value }) => {
      const res = await authClient.signIn.email(loginSchema.parse(value)).catch(() => null)
      if (!res || res.error) {
        setError(authErrorMessage(res?.error?.code))
        return
      }
      setError(null)
      if ("twoFactorRedirect" in res.data && res.data.twoFactorRedirect) onCode()
      else await onDone()
    },
  })
  const signInWithPasskey = async () => {
    setPasskeyBusy(true)
    let failure: string | null
    try {
      failure = await authFailure(authClient.signIn.passkey())
    } finally {
      setPasskeyBusy(false)
    }
    setError(failure)
    if (!failure) await onDone()
  }
  return (
    <TicketCard subtitle="Harmonogram zaliczeń" footer="Logowanie dla prowadzących zajęcia">
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        notice && <Notice tone="info">Hasło ustawione. Zaloguj się.</Notice>
      )}
      <Button size="lg" type="button" disabled={passkeyBusy} onClick={signInWithPasskey}>
        <KeyRound /> Zaloguj kluczem dostępu
      </Button>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        albo hasłem
        <span className="h-px flex-1 bg-border" />
      </div>
      <form.AppForm>
        <form.Form className="grid gap-4">
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label="E-mail"
                type="email"
                autoComplete="username webauthn"
                enterKeyHint="next"
              />
            )}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label="Hasło"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
              />
            )}
          </form.AppField>
          <form.SubmitButton size="lg" className="mt-1">
            Zaloguj się
          </form.SubmitButton>
        </form.Form>
      </form.AppForm>
      {canResetPassword && (
        <Link
          to="/nie-pamietam-hasla"
          className="justify-self-start text-sm text-muted-foreground underline"
        >
          Nie pamiętam hasła
        </Link>
      )}
    </TicketCard>
  )
}

function CodeStep({ onDone, onRestart }: { onDone: () => Promise<void>; onRestart: () => void }) {
  const [backup, setBackup] = useState(false)
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const verify = async (value: string) => {
    if (busy || !value) return
    setBusy(true)
    let failure: string | null
    try {
      failure = await authFailure(
        backup
          ? authClient.twoFactor.verifyBackupCode({ code: value.trim(), trustDevice })
          : authClient.twoFactor.verifyTotp({ code: value, trustDevice }),
      )
    } finally {
      setBusy(false)
    }
    setError(failure)
    if (failure) setCode("")
    else await onDone()
  }
  return (
    <TicketCard subtitle="Potwierdź logowanie">
      {error && <Notice tone="error">{error}</Notice>}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void verify(code)
        }}
      >
        {backup ? (
          <div className="grid gap-1.5">
            <Label htmlFor="backup-code">Kod zapasowy</Label>
            <Input
              id="backup-code"
              autoComplete="off"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="totp-code">Kod z aplikacji</Label>
            <CodeInput id="totp-code" value={code} onChange={setCode} onComplete={verify} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={trustDevice} onCheckedChange={setTrustDevice} />
          Zapamiętaj tę przeglądarkę na 30 dni
        </label>
        <Button size="lg" type="submit" disabled={busy || !code}>
          Potwierdź
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          className="underline"
          onClick={() => {
            setBackup(!backup)
            setCode("")
            setError(null)
          }}
        >
          {backup ? "Wpisz kod z aplikacji" : "Nie mam telefonu: użyj kodu zapasowego"}
        </button>
        <button type="button" className="underline" onClick={onRestart}>
          Wróć
        </button>
      </div>
    </TicketCard>
  )
}
