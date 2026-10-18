import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { DeleteExamButton } from "@/components/delete-exam-button"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { Card, CardContent } from "@/components/ui/card"
import { useResultMutation } from "@/components/use-result-mutation"
import { PageTitle } from "@/components/page-title"
import { UNEXPECTED_ERROR, type Result } from "@/messages.pl"
import { createAccountSchema, setPasswordSchema, updateAccountSchema } from "@/schemas/account"
import {
  accountsQuery,
  blockedAccountExamsQuery,
  createAccount,
  deleteAccountExam,
  type listAccounts,
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

type Account = Awaited<ReturnType<typeof listAccounts>>[number]

const useAccountMutation = <TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  onOk?: (result: { ok: true } & TOut) => void,
) => useResultMutation(fn, [accountsQuery().queryKey], onOk)

function Accounts() {
  const { data: accounts } = useSuspenseQuery(accountsQuery())
  const { user } = Route.useRouteContext()
  return (
    <div className="grid gap-6">
      <PageTitle>Konta prowadzących</PageTitle>
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
  const create = useAccountMutation(createAccount, () =>
    toast.success("Konto utworzone. Przekaż hasło prowadzącemu."),
  )
  const form = useAppForm({
    defaultValues: { email: "", name: "", password: "" },
    ...schemaSubmit(createAccountSchema, create.mutateAsync, { resetOnOk: true }),
  })
  return (
    <SectionCard title="Nowe konto">
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
          <form.SubmitButton className="self-end justify-self-start">
            Utwórz konto
          </form.SubmitButton>
        </form.Form>
      </form.AppForm>
    </SectionCard>
  )
}

function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "password">("view")
  const toggle = (m: "edit" | "password") => setMode(mode === m ? "view" : m)
  const isAdmin = account.role === "admin"
  const ban = useAccountMutation(setAccountBanned)
  const admin = useAccountMutation(setAccountAdmin)
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
              <Button variant="ghost" size="xs" onClick={() => toggle("edit")}>
                Edytuj
              </Button>
              <Button variant="ghost" size="xs" onClick={() => toggle("password")}>
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
          {account.banned && <BlockedAccountExams userId={account.id} />}
        </CardContent>
      </Card>
    </li>
  )
}

function EditAccountForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const update = useAccountMutation(updateAccount, onDone)
  const form = useAppForm({
    defaultValues: { userId: account.id, email: account.email, name: account.name },
    ...schemaSubmit(updateAccountSchema, update.mutateAsync),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <form.AppField name="name">{(f) => <f.TextField label="Imię i nazwisko" />}</form.AppField>
        <form.AppField name="email">
          {(f) => <f.TextField label="E-mail" type="email" />}
        </form.AppField>
        <form.SubmitButton className="self-end justify-self-start">Zapisz</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}

function PasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const set = useAccountMutation(setAccountPassword, () => {
    toast.success("Hasło ustawione, sesje tej osoby wylogowane.")
    onDone()
  })
  const form = useAppForm({
    defaultValues: { userId, password: "" },
    ...schemaSubmit(setPasswordSchema, set.mutateAsync),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
        <form.AppField name="password">
          {(f) => <f.TextField label="Nowe hasło" type="text" autoComplete="off" />}
        </form.AppField>
        <form.SubmitButton className="self-end justify-self-start">Ustaw hasło</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}

/** SPEC: zaliczenia zablokowanego prowadzącego usuwa superadmin (klauzula informacyjna, pkt 6). */
function BlockedAccountExams({ userId }: { userId: string }) {
  const query = blockedAccountExamsQuery(userId)
  const { data: exams, isError } = useQuery(query)
  if (isError) return <p className="text-sm text-destructive">{UNEXPECTED_ERROR}</p>
  if (!exams) return null
  if (exams.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak zaliczeń tego konta.</p>
  }
  return (
    <ul className="grid gap-1 text-sm" aria-label="Zaliczenia zablokowanego konta">
      {exams.map((exam) => (
        <li key={exam.id} className="flex items-center gap-2">
          <span>{exam.name}</span>
          <span className="text-muted-foreground tabular-nums">zapisy: {exam.enrollments}</span>
          <span className="ml-auto">
            <DeleteExamButton
              exam={exam}
              deleteFn={deleteAccountExam}
              invalidate={[query.queryKey]}
              size="xs"
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
