import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useResultMutation } from "@/components/use-result-mutation"
import { createAccountSchema, setPasswordSchema, updateAccountSchema } from "@/schemas/account"
import {
  accountsQuery,
  createAccount,
  setAccountAdmin,
  setAccountBanned,
  setAccountPassword,
  updateAccount,
} from "@/server/accounts"

export const Route = createFileRoute("/_authed/konta")({
  beforeLoad: ({ context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/" })
  },
  loader: ({ context }) => context.queryClient.query({ ...accountsQuery(), staleTime: "static" }),
  head: () => ({ meta: [{ title: "Konta — Terminus" }] }),
  component: Accounts,
})

type Account = Awaited<ReturnType<typeof import("@/server/accounts").listAccounts>>[number]

function Accounts() {
  const { data: accounts } = useSuspenseQuery(accountsQuery())
  const { user } = Route.useRouteContext()
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">Konta prowadzących</h1>
      <CreateAccountForm />
      <ul className="grid gap-3">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} isSelf={a.id === user.id} />
        ))}
      </ul>
    </div>
  )
}

function CreateAccountForm() {
  const create = useResultMutation(createAccount, ["accounts"], () =>
    toast.success("Konto utworzone. Przekaż hasło prowadzącemu."),
  )
  const form = useAppForm({
    defaultValues: { email: "", name: "", password: "" },
    validators: { onSubmit: createAccountSchema },
    onSubmit: async ({ value, formApi }) => {
      if ((await create.mutateAsync(createAccountSchema.parse(value))).ok) formApi.reset()
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nowe konto</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className="grid items-start gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            <form.AppField name="name">
              {(f) => <f.TextField label="Imię i nazwisko" />}
            </form.AppField>
            <form.AppField name="email">
              {(f) => <f.TextField label="E-mail" type="email" />}
            </form.AppField>
            <form.AppField name="password">
              {(f) => <f.TextField label="Hasło" type="text" autoComplete="off" />}
            </form.AppField>
            <div className="self-end">
              <form.SubmitButton>Utwórz konto</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  )
}

function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "password">("view")
  const isAdmin = account.role === "admin"
  const ban = useResultMutation(setAccountBanned, ["accounts"])
  const admin = useResultMutation(setAccountAdmin, ["accounts"])
  return (
    <li>
      <Card size="sm">
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{account.name}</span>
            <span className="text-muted-foreground">{account.email}</span>
            {isAdmin && <Badge>superadmin</Badge>}
            {account.banned && <Badge variant="destructive">zablokowane</Badge>}
            <span className="ml-auto flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMode(mode === "edit" ? "view" : "edit")}
              >
                Edytuj
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMode(mode === "password" ? "view" : "password")}
              >
                Ustaw hasło
              </Button>
              {!isSelf && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => ban.mutate({ userId: account.id, banned: !account.banned })}
                  >
                    {account.banned ? "Odblokuj" : "Zablokuj"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => admin.mutate({ userId: account.id, isAdmin: !isAdmin })}
                  >
                    {isAdmin ? "Odbierz superadmina" : "Nadaj superadmina"}
                  </Button>
                </>
              )}
            </span>
          </div>
          {mode === "edit" && <EditAccountForm account={account} onDone={() => setMode("view")} />}
          {mode === "password" && (
            <PasswordForm userId={account.id} onDone={() => setMode("view")} />
          )}
        </CardContent>
      </Card>
    </li>
  )
}

function EditAccountForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const update = useResultMutation(updateAccount, ["accounts"], onDone)
  const form = useAppForm({
    defaultValues: { userId: account.id, email: account.email, name: account.name },
    validators: { onSubmit: updateAccountSchema },
    onSubmit: ({ value }) => update.mutateAsync(updateAccountSchema.parse(value)),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <form.AppField name="name">{(f) => <f.TextField label="Imię i nazwisko" />}</form.AppField>
        <form.AppField name="email">
          {(f) => <f.TextField label="E-mail" type="email" />}
        </form.AppField>
        <div className="self-end">
          <form.SubmitButton>Zapisz</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  )
}

function PasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const set = useResultMutation(setAccountPassword, ["accounts"], () => {
    toast.success("Hasło ustawione, sesje tej osoby wylogowane.")
    onDone()
  })
  const form = useAppForm({
    defaultValues: { userId, password: "" },
    validators: { onSubmit: setPasswordSchema },
    onSubmit: ({ value }) => set.mutateAsync(setPasswordSchema.parse(value)),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
        <form.AppField name="password">
          {(f) => <f.TextField label="Nowe hasło" type="text" autoComplete="off" />}
        </form.AppField>
        <div className="self-end">
          <form.SubmitButton>Ustaw hasło</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  )
}
