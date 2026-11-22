import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { KeyRound, Smartphone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { PageTitle } from "@/components/page-title"
import { SectionCard } from "@/components/section-card"
import { AddPasskeyButton, BackupCodes, TotpSetup } from "@/components/two-factor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDay } from "@/domain/time"
import { authClient, authWithToast } from "@/lib/auth-client"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/_authed/weryfikacja-dwuetapowa")({
  head: () => ({ meta: [{ title: "Weryfikacja dwuetapowa — Terminus" }] }),
  component: TwoFactorSettings,
})

const passkeysQuery = {
  queryKey: ["passkeys"],
  queryFn: async () => (await authClient.passkey.listUserPasskeys()).data ?? [],
}

const LAST_FACTOR_HINT = "To Twój jedyny sposób potwierdzania logowania. Najpierw dodaj inny."

function TwoFactorSettings() {
  const { user } = Route.useRouteContext()
  const { data: passkeys = [] } = useQuery(passkeysQuery)
  const queryClient = useQueryClient()
  const router = useRouter()
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: passkeysQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey }),
    ])
    await router.invalidate()
  }
  const last = passkeys.length + Number(user.totp) <= 1
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageTitle>Weryfikacja dwuetapowa</PageTitle>
      <SectionCard title="Klucze dostępu">
        <ul className="divide-y rounded-lg border">
          {passkeys.map((p) => (
            <PasskeyRow key={p.id} passkey={p} last={last} onChange={refresh} />
          ))}
          {passkeys.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Brak kluczy.</li>
          )}
        </ul>
        <AddPasskeyButton
          variant="outline"
          size="sm"
          className="justify-self-start"
          onAdded={refresh}
        />
      </SectionCard>
      <SectionCard title="Aplikacja z kodami">
        <TotpSection enabled={user.totp} last={last} onChange={refresh} />
      </SectionCard>
    </div>
  )
}

function PasskeyRow({
  passkey,
  last,
  onChange,
}: {
  passkey: { id: string; name?: string | null; createdAt: Date | string }
  last: boolean
  onChange: () => Promise<void>
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(passkey.name ?? "")
  const rename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await authWithToast(authClient.passkey.updatePasskey({ id: passkey.id, name }))) {
      setRenaming(false)
      await onChange()
    }
  }
  return (
    <li className="grid gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <span>{passkey.name || "Klucz dostępu"}</span>
        <span className="text-xs text-muted-foreground">
          dodany {formatDay(new Date(passkey.createdAt))}
        </span>
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => setRenaming(!renaming)}>
            Zmień nazwę
          </Button>
          <ConfirmButton
            disabled={last}
            title="Usunąć klucz dostępu?"
            description={`Klucz „${passkey.name || "Klucz dostępu"}” przestanie działać przy logowaniu.`}
            confirmLabel="Usuń klucz"
            onConfirm={async () => {
              if (await authWithToast(authClient.passkey.deletePasskey({ id: passkey.id }))) {
                await onChange()
              }
            }}
          >
            Usuń
          </ConfirmButton>
        </span>
      </div>
      {last && <p className="text-xs text-muted-foreground">{LAST_FACTOR_HINT}</p>}
      {renaming && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={rename}>
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${passkey.id}`}>Nazwa klucza</Label>
            <Input
              id={`name-${passkey.id}`}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Zapisz
          </Button>
        </form>
      )}
    </li>
  )
}

type TotpAction = "codes" | "disable"

function TotpSection({
  enabled,
  last,
  onChange,
}: {
  enabled: boolean
  last: boolean
  onChange: () => Promise<void>
}) {
  const [connecting, setConnecting] = useState(false)
  const [action, setAction] = useState<TotpAction | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)

  if (!enabled)
    return connecting ? (
      <TotpSetup
        onDone={async () => {
          setConnecting(false)
          await onChange()
        }}
      />
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => setConnecting(true)}
      >
        <Smartphone /> Połącz aplikację
      </Button>
    )

  const confirm = async (password: string) => {
    if (action === "codes") {
      const res = await authClient.twoFactor.generateBackupCodes({ password }).catch(() => null)
      if (res?.data) setCodes(res.data.backupCodes)
      else await authWithToast(Promise.resolve({ error: res?.error ?? {} }))
    } else if (await authWithToast(authClient.twoFactor.disable({ password }))) {
      toast.success("Aplikacja odłączona.")
      await onChange()
    }
    setAction(null)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Połączona</span>
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => setAction("codes")}>
            Nowe kody zapasowe
          </Button>
          <Button variant="ghost" size="xs" disabled={last} onClick={() => setAction("disable")}>
            Odłącz
          </Button>
        </span>
      </div>
      {last && <p className="text-xs text-muted-foreground">{LAST_FACTOR_HINT}</p>}
      {action && (
        <PasswordConfirm
          label={action === "codes" ? "Pokaż nowe kody" : "Odłącz aplikację"}
          onConfirm={confirm}
        />
      )}
      {codes && <BackupCodes codes={codes} />}
    </div>
  )
}

function PasswordConfirm({
  label,
  onConfirm,
}: {
  label: string
  onConfirm: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm(password)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-password">Twoje hasło</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={busy || !password}>
        {label}
      </Button>
    </form>
  )
}
