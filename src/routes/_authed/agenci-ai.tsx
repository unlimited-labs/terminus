import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Bot, Copy } from "lucide-react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { SectionCard } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import { formatDay } from "@/domain/time"
import { agentsQuery, disconnectAgent } from "@/server/agents"

export const Route = createFileRoute("/_authed/agenci-ai")({
  head: () => ({ meta: [{ title: "Agenci AI — Terminus" }] }),
  component: AgentsPage,
})

function AgentsPage() {
  return (
    <SectionCard title="Agenci AI" className="mx-auto max-w-2xl" contentClassName="grid gap-4">
      <AgentsSection />
    </SectionCard>
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
