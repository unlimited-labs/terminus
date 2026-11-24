import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { Notice } from "@/components/notice"
import { AddPasskeyButton, TotpSetup } from "@/components/two-factor"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/components/use-logout"
import { authWithToast } from "@/lib/auth-client"
import { oauthAuthClient } from "@/lib/teacher-auth-client"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/konfiguracja-2fa")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(sessionQuery())
    if (!user) throw redirect({ to: "/login" })
    // Tu odsyła serwer autoryzacji, gdy agenta podłącza konto bez 2FA (podpisany adres z `sig`).
    const oauth = "sig" in location.search
    if (user.twoFactorReady && !oauth) throw redirect({ to: "/" })
    return { oauth, ready: user.twoFactorReady }
  },
  head: () => ({ meta: [{ title: "Zabezpiecz konto — Terminus" }] }),
  component: SetupTwoFactor,
})

function SetupTwoFactor() {
  const logout = useLogout()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // `ready` przy `oauth`: odświeżona strona po konfiguracji, zostaje tylko powrót do podłączania.
  const { oauth, ready } = Route.useRouteContext()
  const [passkeyAdded, setPasskeyAdded] = useState(false)
  const finish = async () => {
    // Serwer sprawdza 2FA jeszcze raz i odsyła na `/zgoda` albo do agenta.
    if (oauth)
      return void (await authWithToast(oauthAuthClient.oauth2.continue({ postLogin: true })))
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
          Dodaj drugi sposób logowania: klucz dostępu albo aplikację z kodami.
        </p>
      </div>
      {ready ? (
        <section className="grid max-w-lg gap-4">
          <Notice tone="info">Konto jest już zabezpieczone.</Notice>
          <Button className="justify-self-start" onClick={finish}>
            Dalej
          </Button>
        </section>
      ) : (
        <section className="grid max-w-lg gap-4">
          {passkeyAdded ? (
            <>
              <Notice tone="info">
                {oauth
                  ? "Klucz dostępu dodany."
                  : "Klucz dostępu dodany. Możesz przejść do zaliczeń."}
              </Notice>
              <p className="text-sm text-muted-foreground">
                Jeśli zgubisz to urządzenie, odzyskasz dostęp tylko przez superadmina. Drugi klucz
                albo aplikacja z kodami oszczędzą Ci kłopotu.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={finish}>{oauth ? "Dalej" : "Przejdź do zaliczeń"}</Button>
                <AddPasskeyButton variant="outline">Dodaj drugi klucz</AddPasskeyButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                Przeglądarka poprosi o odcisk palca, twarz, PIN urządzenia albo klucz sprzętowy.
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
      )}
    </main>
  )
}
