import { KeyRound } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState, useTransition, type ComponentProps } from "react"
import { toast } from "sonner"

import { CodeInput } from "@/components/code-input"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authFailure, authResult, authWithToast } from "@/lib/auth-client"
import { teacherAuthClient } from "@/lib/teacher-auth-client"
import { confirmPasswordSchema } from "@/schemas/auth"

/** Rejestracja klucza dostępu (przeglądarka pyta o odcisk palca, twarz, PIN albo klucz sprzętowy). */
export function AddPasskeyButton({
  onAdded,
  children = "Dodaj klucz dostępu",
  ...button
}: { onAdded?: () => unknown } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const [pending, startTransition] = useTransition()
  const add = () =>
    startTransition(async () => {
      if (await authWithToast(teacherAuthClient.passkey.addPasskey())) await onAdded?.()
    })
  return (
    <Button {...button} disabled={pending} onClick={add}>
      <KeyRound /> {children}
    </Button>
  )
}

/** Hasło konta jako potwierdzenie operacji na 2FA (Better Auth go wymaga). */
export function PasswordConfirm({
  label,
  onConfirm,
}: {
  label: string
  onConfirm: (password: string) => Promise<unknown>
}) {
  const form = useAppForm({
    defaultValues: { password: "" },
    ...schemaSubmit(confirmPasswordSchema, ({ password }) => onConfirm(password)),
  })
  return (
    <form.AppForm>
      <form.Form className="grid max-w-sm items-end gap-3 sm:grid-cols-[1fr_auto]">
        <form.AppField name="password">
          {(f) => (
            <f.TextField label="Twoje hasło" type="password" autoComplete="current-password" />
          )}
        </form.AppField>
        <form.SubmitButton className="self-end justify-self-start">{label}</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}

/** Kody zapasowe: pokazane raz, do skopiowania albo pobrania. */
export function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n")
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => toast.success("Kody skopiowane."),
      () => toast.error("Nie udało się skopiować. Zaznacz kody i skopiuj ręcznie."),
    )
  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(`Terminus — kody zapasowe\n\n${text}\n`)}`
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Kody zapasowe. Każdy działa raz, gdy nie masz telefonu pod ręką. Zapisz je teraz, więcej ich
        nie pokażemy.
      </p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-muted p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          Kopiuj
        </Button>
        <a
          href={href}
          download="terminus-kody.txt"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Pobierz .txt
        </a>
      </div>
    </div>
  )
}

type TotpStage =
  | { step: "password" }
  | { step: "scan"; uri: string; codes: string[] }
  | { step: "codes"; codes: string[] }

/** Połączenie aplikacji z kodami: hasło → kod QR i pierwszy kod → kody zapasowe. */
export function TotpSetup({ onDone }: { onDone: () => unknown }) {
  const [stage, setStage] = useState<TotpStage>({ step: "password" })
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const start = async (password: string) => {
    const { data, failure } = await authResult(
      teacherAuthClient.twoFactor.enable({ password, method: "totp" }),
    )
    setError(failure)
    if (data?.method === "totp")
      setStage({ step: "scan", uri: data.totpURI, codes: data.backupCodes })
  }

  const verify = (value: string) => {
    if (pending || stage.step !== "scan") return
    startTransition(async () => {
      const failure = await authFailure(teacherAuthClient.twoFactor.verifyTotp({ code: value }))
      setError(failure)
      if (failure) setCode("")
      else setStage({ step: "codes", codes: stage.codes })
    })
  }

  if (stage.step === "password")
    return (
      <div className="grid gap-3">
        {error && <Notice tone="error">{error}</Notice>}
        <PasswordConfirm label="Dalej" onConfirm={start} />
      </div>
    )

  if (stage.step === "scan") {
    const secret = new URL(stage.uri).searchParams.get("secret")
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <QRCodeSVG value={stage.uri} size={144} className="rounded-md bg-white p-2" />
          <div className="grid max-w-64 gap-2 text-sm">
            <p>
              Zeskanuj kod aplikacją uwierzytelniającą (np. Google Authenticator, Aegis, 1Password).
            </p>
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Nie możesz zeskanować?</summary>
              <code className="mt-1 block break-all">{secret}</code>
            </details>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="totp-first-code">Kod z aplikacji</Label>
          <CodeInput id="totp-first-code" value={code} onChange={setCode} onComplete={verify} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button
          className="justify-self-start"
          disabled={pending || code.length < 6}
          onClick={() => verify(code)}
        >
          Sprawdź kod
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <BackupCodes codes={stage.codes} />
      <Button className="justify-self-start" onClick={onDone}>
        Zapisałem kody
      </Button>
    </div>
  )
}
