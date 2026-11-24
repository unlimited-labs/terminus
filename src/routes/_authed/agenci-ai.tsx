import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Bot, Copy } from "lucide-react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { PageTitle } from "@/components/page-title"
import { SectionCard } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import { formatDay } from "@/domain/time"
import type { connectedAgents } from "@/server/agent-ops.server"
import { agentsQuery, disconnectAgent } from "@/server/agents"

export const Route = createFileRoute("/_authed/agenci-ai")({
  head: () => ({ meta: [{ title: "Agenci AI — Terminus" }] }),
  component: AgentsPage,
})

function AgentsPage() {
  const { data } = useQuery(agentsQuery())
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <PageTitle>Agenci AI</PageTitle>
        <p className="text-muted-foreground">
          Agent AI (np. Claude, ChatGPT) działa w Twoim imieniu na Twoich zaliczeniach.
        </p>
      </div>
      {data && (
        <>
          <SectionCard title="Podłączeni agenci">
            <AgentList agents={data.agents} />
          </SectionCard>
          <SectionCard title="Jak podłączyć agenta" contentClassName="grid gap-4">
            <ConnectSteps mcpUrl={data.mcpUrl} />
          </SectionCard>
        </>
      )}
    </div>
  )
}

type Agent = Awaited<ReturnType<typeof connectedAgents>>[number]

function AgentList({ agents }: { agents: Agent[] }) {
  const queryClient = useQueryClient()
  return (
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
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const copy = () =>
    navigator.clipboard.writeText(value).then(
      () => toast.success("Skopiowano."),
      () => toast.error(`Nie udało się skopiować. Skopiuj ręcznie: ${value}`),
    )
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-sm break-all">
        {value}
      </code>
      <Button variant="outline" size="sm" onClick={copy} aria-label={`Kopiuj: ${label}`}>
        <Copy /> Kopiuj
      </Button>
    </div>
  )
}

function ConnectSteps({ mcpUrl }: { mcpUrl: string }) {
  return (
    <>
      <div className="grid gap-1.5">
        <p className="text-sm font-medium">Adres serwera</p>
        <CopyField label="adres serwera" value={mcpUrl} />
      </div>
      <ul className="divide-y rounded-lg border text-sm">
        <li className="grid gap-1 px-3 py-2">
          <span className="font-semibold">claude.ai i Claude Desktop</span>
          <span className="text-muted-foreground">
            Ustawienia → Konektory → Dodaj własny konektor, wklej adres.
          </span>
        </li>
        <li className="grid gap-2 px-3 py-2">
          <span className="font-semibold">Claude Code</span>
          <CopyField
            label="polecenie Claude Code"
            value={`claude mcp add --transport http terminus ${mcpUrl}`}
          />
        </li>
        <li className="grid gap-1 px-3 py-2">
          <span className="font-semibold">ChatGPT</span>
          <span className="text-muted-foreground">
            Ustawienia → Aplikacje i konektory → Utwórz (tryb dewelopera), wklej adres.
          </span>
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Agent poprosi o zalogowanie i zgodę; potem pojawi się w „Podłączonych agentach”.
      </p>
    </>
  )
}
