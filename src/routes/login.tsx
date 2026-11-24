import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { KeyRound } from "lucide-react"
import { useState, useTransition } from "react"

import { submitThenChange, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { TicketCard } from "@/components/ticket-card"
import { CodeInput } from "@/components/code-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isAgentConnectFlow } from "@/domain/agents"
import { authFailure, authResult } from "@/lib/auth-client"
import { oauthAuthClient } from "@/lib/teacher-auth-client"
import { loginSchema, loginSearchSchema } from "@/schemas/auth"
import { mailAvailable } from "@/server/password-link"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, location }) => {
    // Podłączanie agenta (podpisany adres z `sig`) może wymagać ponownego logowania (`prompt=login`).
    const oauth = isAgentConnectFlow(location.search)
    if (!oauth && (await context.queryClient.query(sessionQuery()))) throw redirect({ to: "/" })
    return { oauth }
  },
  loader: () => mailAvailable(),
  // Konfiguracja poczty nie zmienia się bez restartu serwera.
  staleTime: Infinity,
  head: () => ({ meta: [{ title: "Logowanie — Terminus" }] }),
  component: Login,
})

function Login() {
  const { redirect: target, haslo } = Route.useSearch()
  const navigate = useNavigate()
  const { queryClient, oauth } = Route.useRouteContext()
  const [step, setStep] = useState<"password" | "code">("password")
  const enter = async () => {
    // Przy podłączaniu agenta serwer odsyła dalej (`/konfiguracja-2fa`, `/zgoda` albo do agenta).
    if (oauth) return
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
  const [passkeyPending, startPasskey] = useTransition()
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    ...submitThenChange(loginSchema),
    onSubmit: async ({ value }) => {
      const { data, failure } = await authResult(
        oauthAuthClient.signIn.email(loginSchema.parse(value)),
      )
      setError(failure)
      if (!data) return
      if ("twoFactorRedirect" in data && data.twoFactorRedirect) onCode()
      else await onDone()
    },
  })
  const signInWithPasskey = () =>
    startPasskey(async () => {
      const failure = await authFailure(oauthAuthClient.signIn.passkey())
      setError(failure)
      if (!failure) await onDone()
    })
  return (
    <TicketCard subtitle="Harmonogram zaliczeń" footer="Logowanie dla prowadzących zajęcia">
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        notice && <Notice tone="info">Hasło ustawione. Zaloguj się.</Notice>
      )}
      <Button size="lg" type="button" disabled={passkeyPending} onClick={signInWithPasskey}>
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
  const [busy, startVerify] = useTransition()
  const verify = (value: string) => {
    if (busy || !value) return
    startVerify(async () => {
      const failure = await authFailure(
        backup
          ? oauthAuthClient.twoFactor.verifyBackupCode({ code: value.trim(), trustDevice })
          : oauthAuthClient.twoFactor.verifyTotp({ code: value, trustDevice }),
      )
      setError(failure)
      if (failure) setCode("")
      else await onDone()
    })
  }
  return (
    <TicketCard subtitle="Potwierdź logowanie">
      {error && <Notice tone="error">{error}</Notice>}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          verify(code)
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
