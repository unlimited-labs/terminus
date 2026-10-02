import { Link, Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { UNEXPECTED_ERROR } from "@/messages.pl"
import { getSessionUser } from "@/server/session"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const user = await getSessionUser()
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } })
    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user, queryClient } = Route.useRouteContext()
  const router = useRouter()
  const logout = async () => {
    const { error } = await authClient.signOut().catch(() => ({ error: true }))
    if (error) {
      toast.error(UNEXPECTED_ERROR)
      return
    }
    queryClient.clear()
    await router.navigate({ to: "/login" })
  }
  return (
    <div className="min-h-svh">
      <header className="border-b bg-card">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link to="/" className="font-extrabold">
            Terminus
          </Link>
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="data-[status=active]:text-primary"
          >
            Moje zaliczenia
          </Link>
          {user.isAdmin && (
            <Link to="/konta" className="data-[status=active]:text-primary">
              Konta
            </Link>
          )}
          <span className="ml-auto text-muted-foreground">{user.name}</span>
          <Link to="/haslo" className="data-[status=active]:text-primary">
            Zmień hasło
          </Link>
          <Button variant="outline" size="sm" onClick={logout}>
            Wyloguj
          </Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
