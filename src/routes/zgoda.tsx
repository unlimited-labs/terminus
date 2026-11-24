import { createFileRoute } from "@tanstack/react-router"
import { useState, useTransition } from "react"
import { z } from "zod"

import { Notice } from "@/components/notice"
import { TicketCard } from "@/components/ticket-card"
import { Button } from "@/components/ui/button"
import { authFailure } from "@/lib/auth-client"
import { oauthAuthClient } from "@/lib/teacher-auth-client"
import { agentToConnect } from "@/server/agents"

export const Route = createFileRoute("/zgoda")({
  validateSearch: z.object({ client_id: z.string().max(2000).catch("") }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    deps.client_id ? agentToConnect({ data: { clientId: deps.client_id } }) : null,
  head: () => ({ meta: [{ title: "Podłączenie agenta — Terminus" }] }),
  component: Consent,
})

function Consent() {
  const agent = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [pending, startAnswer] = useTransition()
  // Odpowiedź wysyła podpisane parametry z adresu; serwer odsyła do agenta, przeglądarkę przenosi klient Better Auth.
  const answer = (accept: boolean) =>
    startAnswer(async () => setError(await authFailure(oauthAuthClient.oauth2.consent({ accept }))))

  if (!agent)
    return (
      <TicketCard subtitle="Podłączenie agenta">
        <Notice tone="error">Link wygasł. Wróć do agenta AI i podłącz go jeszcze raz.</Notice>
      </TicketCard>
    )

  return (
    <TicketCard subtitle="Podłączenie agenta">
      {error && <Notice tone="error">{error}</Notice>}
      <h2 className="text-xl font-extrabold">Podłączyć agenta AI?</h2>
      <p>
        <strong>{agent.name}</strong>
        {agent.host && ` (${agent.host})`} będzie działać w Twoim imieniu: czytać i zmieniać Twoje
        zaliczenia, sloty, listy indeksów, zapisy i oceny.
      </p>
      <p>
        Agent zobaczy dane studentów z Twoich zaliczeń (imiona, nazwiska, numery indeksów, adresy
        e-mail, oceny), a trafią one do dostawcy modelu, którego używasz. Podłączaj tylko narzędzia
        dopuszczone przez AGH.
      </p>
      <p>Odłączysz go w każdej chwili na stronie Weryfikacja dwuetapowa.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={pending} onClick={() => answer(true)}>
          Podłącz
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => answer(false)}>
          Anuluj
        </Button>
      </div>
    </TicketCard>
  )
}
