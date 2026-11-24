import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Bot, Copy, KeyRound, Smartphone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { PageTitle } from "@/components/page-title"
import { SectionCard } from "@/components/section-card"
import { AddPasskeyButton, BackupCodes, PasswordConfirm, TotpSetup } from "@/components/two-factor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDay } from "@/domain/time"
import { authResult, authWithToast } from "@/lib/auth-client"
import { teacherAuthClient } from "@/lib/teacher-auth-client"
import { toastFailure } from "@/components/use-result-mutation"
import { LAST_FACTOR } from "@/messages.pl"
import { agentsQuery, disconnectAgent } from "@/server/agents"
import { deletePasskey, disconnectAuthenticator } from "@/server/factors"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/_authed/weryfikacja-dwuetapowa")({
  head: () => ({ meta: [{ title: "Weryfikacja dwuetapowa — Terminus" }] }),
  component: TwoFactorSettings,
})

const passkeysQuery = {
  queryKey: ["passkeys"],
  queryFn: async () => (await teacherAuthClient.passkey.listUserPasskeys()).data ?? [],
}

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
      <SectionCard title="Agenci AI" contentClassName="grid gap-4">
        <AgentsSection />
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
    if (await authWithToast(teacherAuthClient.passkey.updatePasskey({ id: passkey.id, name }))) {
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
              const result = await deletePasskey({ data: { passkeyId: passkey.id } })
              if (result.ok) await onChange()
              else toastFailure(result)
              return result
            }}
          >
            Usuń
          </ConfirmButton>
        </span>
      </div>
      {last && <p className="text-xs text-muted-foreground">{LAST_FACTOR}</p>}
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

type TotpMode =
  | { kind: "idle" }
  | { kind: "connect" }
  | { kind: "confirm"; action: "codes" | "disable" }
  | { kind: "codes"; codes: string[] }

function TotpSection({
  enabled,
  last,
  onChange,
}: {
  enabled: boolean
  last: boolean
  onChange: () => Promise<void>
}) {
  const [mode, setMode] = useState<TotpMode>({ kind: "idle" })

  if (!enabled)
    return mode.kind === "connect" ? (
      <TotpSetup
        onDone={async () => {
          setMode({ kind: "idle" })
          await onChange()
        }}
      />
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => setMode({ kind: "connect" })}
      >
        <Smartphone /> Połącz aplikację
      </Button>
    )

  const confirm = async (password: string) => {
    if (mode.kind !== "confirm") return
    if (mode.action === "codes") {
      const { data, failure } = await authResult(
        teacherAuthClient.twoFactor.generateBackupCodes({ password }),
      )
      if (failure) toast.error(failure)
      setMode(data ? { kind: "codes", codes: data.backupCodes } : { kind: "idle" })
    } else {
      const result = await disconnectAuthenticator({ data: { password } })
      if (!result.ok) return toastFailure(result)
      toast.success("Aplikacja odłączona.")
      setMode({ kind: "idle" })
      await onChange()
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Połączona</span>
        <span className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setMode({ kind: "confirm", action: "codes" })}
          >
            Nowe kody zapasowe
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={last}
            onClick={() => setMode({ kind: "confirm", action: "disable" })}
          >
            Odłącz
          </Button>
        </span>
      </div>
      {last && <p className="text-xs text-muted-foreground">{LAST_FACTOR}</p>}
      {mode.kind === "confirm" && (
        <PasswordConfirm
          key={mode.action}
          label={mode.action === "codes" ? "Pokaż nowe kody" : "Odłącz aplikację"}
          onConfirm={confirm}
        />
      )}
      {mode.kind === "codes" && <BackupCodes codes={mode.codes} />}
    </div>
  )
}

function AgentsSection() {
  const { data } = useQuery(agentsQuery())
  const queryClient = useQueryClient()
  if (!data) return null
  const { mcpUrl, agents } = data
  const copy = () =>
    navigator.clipboard.writeText(mcpUrl).then(
      () => toast.success("Skopiowano adres."),
      () => toast.error(`Nie udało się skopiować. Adres do skopiowania ręcznie: ${mcpUrl}`),
    )
  return (
    <>
      <ul aria-label="Podłączeni agenci" className="divide-y rounded-lg border">
        {agents.map((a) => (
          <li key={a.clientId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Bot className="size-4 text-muted-foreground" />
            <span>{a.name}</span>
            {a.host && <span className="text-xs text-muted-foreground">{a.host}</span>}
            <span className="text-xs text-muted-foreground">
              podłączony {formatDay(new Date(a.connectedAt))}
            </span>
            <span className="ml-auto">
              <ConfirmButton
                title="Odłączyć agenta?"
                description={`„${a.name}” straci dostęp do Twoich zaliczeń. Podłączysz go ponownie, logując się w nim jeszcze raz.`}
                confirmLabel="Odłącz agenta"
                onConfirm={async () => {
                  await disconnectAgent({ data: { clientId: a.clientId } })
                  await queryClient.invalidateQueries({ queryKey: agentsQuery().queryKey })
                }}
              >
                Odłącz
              </ConfirmButton>
            </span>
          </li>
        ))}
        {agents.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Brak podłączonych agentów.</li>
        )}
      </ul>
      <div className="grid gap-2 text-sm">
        <p>
          Agent AI (np. Claude, ChatGPT) działa w Twoim imieniu na Twoich zaliczeniach. Adres
          serwera:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-1 font-mono">{mcpUrl}</code>
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy /> Kopiuj
          </Button>
        </div>
        <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
          <li>
            claude.ai i Claude Desktop: Ustawienia → Konektory → Dodaj własny konektor, wklej adres.
          </li>
          <li>
            Claude Code:{" "}
            <code className="font-mono">claude mcp add --transport http terminus {mcpUrl}</code>
          </li>
          <li>
            ChatGPT: Ustawienia → Aplikacje i konektory → Utwórz (tryb dewelopera), wklej adres.
          </li>
        </ul>
        <p className="text-muted-foreground">
          Agent poprosi o zalogowanie i zgodę; potem pojawi się na liście powyżej.
        </p>
      </div>
    </>
  )
}
