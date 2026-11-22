import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { Notice } from "@/components/notice"
import { AddPasskeyButton, TotpSetup } from "@/components/two-factor"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/components/use-logout"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/konfiguracja-2fa")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query(sessionQuery())
    if (!user) throw redirect({ to: "/login" })
    if (user.twoFactorReady) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: "Zabezpiecz konto — Terminus" }] }),
  component: SetupTwoFactor,
})

function SetupTwoFactor() {
  const logout = useLogout()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [passkeyAdded, setPasskeyAdded] = useState(false)
  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey })
    await navigate({ to: "/" })
  }
  return (
    <main className="mx-auto grid max-w-2xl gap-6 p-4 pt-10">
      <div className="flex items-center justify-between gap-4">
        <span className="font-extrabold">Terminus</span>
        <Button variant="outline" size="sm" onClick={logout}>
          Wyloguj
        </Button>
      </div>
      <div className="grid gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Zabezpiecz konto</h1>
        <p className="text-muted-foreground">
          Każdy prowadzący potwierdza logowanie czymś poza hasłem. Bez tego zaliczenia pozostaną
          zamknięte.
        </p>
      </div>
      <section className="grid max-w-lg gap-4">
        {passkeyAdded ? (
          <>
            <Notice tone="info">Klucz dostępu dodany. Możesz przejść do zaliczeń.</Notice>
            <p className="text-sm text-muted-foreground">
              Jeśli zgubisz to urządzenie, odzyskasz dostęp tylko przez superadmina. Drugi klucz
              albo aplikacja z kodami oszczędzą Ci kłopotu.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={finish}>Przejdź do zaliczeń</Button>
              <AddPasskeyButton variant="outline">Dodaj drugi klucz</AddPasskeyButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              Przeglądarka zapyta o odcisk palca, twarz, PIN urządzenia albo klucz sprzętowy. Potem
              logujesz się bez hasła.
            </p>
            <AddPasskeyButton
              className="justify-self-start"
              onAdded={() => setPasskeyAdded(true)}
            />
          </>
        )}
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            {passkeyAdded
              ? "Dodaj też aplikację z kodami"
              : "Nie masz klucza ani telefonu z biometrią? Użyj aplikacji z kodami"}
          </summary>
          <div className="pt-4">
            <TotpSetup onDone={finish} />
          </div>
        </details>
      </section>
    </main>
  )
}
