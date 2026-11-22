import { KeyRound } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState, type ComponentProps, type ReactNode } from "react"
import { toast } from "sonner"

import { CodeInput } from "@/components/code-input"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authFailure, authWithToast } from "@/lib/auth-client"
import { teacherAuthClient as authClient } from "@/lib/teacher-auth-client"
import { authErrorMessage } from "@/messages.pl"

/** Rejestracja klucza dostępu (przeglądarka pyta o odcisk palca, twarz, PIN albo klucz sprzętowy). */
export function AddPasskeyButton({
  onAdded,
  children = "Dodaj klucz dostępu",
  ...button
}: { onAdded: () => unknown; children?: ReactNode } & Omit<
  ComponentProps<typeof Button>,
  "onClick" | "children"
>) {
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    try {
      if (await authWithToast(authClient.passkey.addPasskey())) await onAdded()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button {...button} disabled={busy} onClick={add}>
      <KeyRound /> {children}
    </Button>
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
  | {
      step: "codes"
      codes: string[]
    }

/** Połączenie aplikacji z kodami: hasło → kod QR i pierwszy kod → kody zapasowe. */
export function TotpSetup({ onDone }: { onDone: () => unknown }) {
  const [stage, setStage] = useState<TotpStage>({ step: "password" })
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    let res
    try {
      res = await authClient.twoFactor.enable({ password, method: "totp" }).catch(() => null)
    } finally {
      setBusy(false)
    }
    if (!res?.data || res.data.method !== "totp") {
      setError(authErrorMessage(res?.error?.code))
      return
    }
    setError(null)
    setStage({ step: "scan", uri: res.data.totpURI, codes: res.data.backupCodes })
  }

  const verify = async (value: string) => {
    if (stage.step !== "scan" || busy) return
    setBusy(true)
    let failure: string | null
    try {
      failure = await authFailure(authClient.twoFactor.verifyTotp({ code: value }))
    } finally {
      setBusy(false)
    }
    setError(failure)
    if (failure) setCode("")
    else setStage({ step: "codes", codes: stage.codes })
  }

  if (stage.step === "password")
    return (
      <form className="grid max-w-sm gap-3" onSubmit={start}>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-1.5">
          <Label htmlFor="totp-password">Twoje hasło</Label>
          <Input
            id="totp-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="justify-self-start" disabled={busy || !password}>
          Dalej
        </Button>
      </form>
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
          disabled={busy || code.length < 6}
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
