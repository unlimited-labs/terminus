import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout } from "@/components/use-logout"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(sessionQuery())
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } })
    if (!user.twoFactorReady) throw redirect({ to: "/konfiguracja-2fa" })
    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const logout = useLogout()
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
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="ml-auto" />}>
              {user.name} <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuItem render={<Link to="/haslo" />}>Zmień hasło</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/weryfikacja-dwuetapowa" />}>
                  Weryfikacja dwuetapowa
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>Wyloguj</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
