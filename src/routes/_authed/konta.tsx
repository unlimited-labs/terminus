import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-button"
import { DeleteExamButton } from "@/components/delete-exam-button"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { PageTitle } from "@/components/page-title"
import { SectionCard } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResultMutation } from "@/components/use-result-mutation"
import type { AccountState } from "@/domain/account-state"
import { PASSWORD_LINK_HOURS } from "@/domain/limits"
import { formatDayTime } from "@/domain/time"
import { EMAIL_LOGIN_UNCONFIGURED, UNEXPECTED_ERROR, type Result } from "@/messages.pl"
import { createAccountSchema, updateAccountSchema } from "@/schemas/account"
import {
  accountsQuery,
  blockedAccountExamsQuery,
  createAccount,
  deleteAccountExam,
  type listAccounts,
  resetTwoFactorOf,
  sendPasswordLinkTo,
  setAccountAdmin,
  setAccountBanned,
  updateAccount,
} from "@/server/accounts"
import { mailAvailable } from "@/server/password-link"

export const Route = createFileRoute("/_authed/konta")({
  beforeLoad: ({ context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/" })
  },
  loader: async ({ context }) => {
    await context.queryClient.query({ ...accountsQuery(), staleTime: "static" })
    return { mail: await mailAvailable() }
  },
  head: () => ({ meta: [{ title: "Konta — Terminus" }] }),
  component: Accounts,
})

type Account = Awaited<ReturnType<typeof listAccounts>>[number]

const STATE_LABEL: Record<AccountState, string> = {
  invited: "Zaproszone",
  no2fa: "Bez 2FA",
  active: "Aktywne",
  banned: "Zablokowane",
}

const useAccountMutation = <TInput, TOut extends object>(
  fn: (opts: { data: TInput }) => Promise<Result<TOut>>,
  onOk?: (result: { ok: true } & TOut) => void,
) => useResultMutation(fn, [accountsQuery().queryKey], onOk)

function Accounts() {
  const { data: accounts } = useSuspenseQuery(accountsQuery())
  const { user } = Route.useRouteContext()
  const { mail } = Route.useLoaderData()
  return (
    <div className="grid gap-6">
      <PageTitle>Konta prowadzących</PageTitle>
      <InviteForm mail={mail} />
      <ul className="divide-y rounded-lg border bg-card" aria-label="Konta prowadzących">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} isSelf={a.id === user.id} mail={mail} />
        ))}
      </ul>
    </div>
  )
}

function InviteForm({ mail }: { mail: boolean }) {
  const invite = useAccountMutation(createAccount, () =>
    toast.success(`Zaproszenie wysłane. Link działa ${PASSWORD_LINK_HOURS} godziny.`),
  )
  const form = useAppForm({
    defaultValues: { email: "", name: "" },
    ...schemaSubmit(createAccountSchema, invite.mutateAsync, { resetOnOk: true }),
  })
  return (
    <SectionCard title="Zaproś prowadzącego">
      {!mail && (
        <Notice tone="notice">
          {EMAIL_LOGIN_UNCONFIGURED} Bez niej nikogo nie zaprosisz; konto superadmina zakłada skrypt{" "}
          <code>seed-admin</code>.
        </Notice>
      )}
      <form.AppForm>
        <form.Form className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <fieldset disabled={!mail} className="contents">
            <form.AppField name="name">
              {(f) => <f.TextField label="Imię i nazwisko" />}
            </form.AppField>
            <form.AppField name="email">
              {(f) => <f.TextField label="E-mail" type="email" />}
            </form.AppField>
            <form.SubmitButton className="self-end justify-self-start">
              Wyślij zaproszenie
            </form.SubmitButton>
          </fieldset>
        </form.Form>
      </form.AppForm>
    </SectionCard>
  )
}

function AccountState({ account: a }: { account: Account }) {
  return (
    <div className="col-start-1 row-start-2 text-sm sm:col-start-2 sm:row-start-1">
      <p className={a.state === "banned" ? "text-destructive" : undefined}>
        {STATE_LABEL[a.state]}
      </p>
      {a.state === "invited" && (
        <p className="text-muted-foreground">
          {a.linkExpiresAt ? `link ważny do ${formatDayTime(a.linkExpiresAt)}` : "link wygasł"}
        </p>
      )}
      {a.state === "no2fa" && <p className="text-muted-foreground">konfiguruje przy logowaniu</p>}
    </div>
  )
}

function AccountRow({
  account: a,
  isSelf,
  mail,
}: {
  account: Account
  isSelf: boolean
  mail: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<"reset2fa" | "ban" | null>(null)
  const isAdmin = a.role === "admin"
  const ban = useAccountMutation(setAccountBanned)
  const admin = useAccountMutation(setAccountAdmin)
  const link = useAccountMutation(sendPasswordLinkTo, () =>
    toast.success(a.state === "invited" ? "Zaproszenie wysłane ponownie." : "Link wysłany."),
  )
  const reset2fa = useAccountMutation(resetTwoFactorOf, () =>
    toast.success("2FA zresetowane. Przy następnym logowaniu ta osoba skonfiguruje je od nowa."),
  )
  const confirmProps = (kind: "reset2fa" | "ban") => ({
    open: confirm === kind,
    onOpenChange: (open: boolean) => setConfirm(open ? kind : null),
  })
  return (
    <li className="grid gap-3 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[1fr_11rem_auto]">
        <div className="min-w-0">
          <p className="truncate font-medium">{a.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {a.email}
            {isAdmin && ", superadmin"}
          </p>
        </div>
        <AccountState account={a} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Akcje: ${a.name}`}
                className="row-span-2 sm:row-span-1"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-56">
            <DropdownMenuItem onClick={() => setEditing(!editing)}>
              Edytuj imię i adres
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!mail} onClick={() => link.mutate({ userId: a.id })}>
              {a.state === "invited"
                ? "Wyślij zaproszenie ponownie"
                : "Wyślij link do zmiany hasła"}
            </DropdownMenuItem>
            {!isSelf && (
              <>
                <DropdownMenuItem onClick={() => admin.mutate({ userId: a.id, isAdmin: !isAdmin })}>
                  {isAdmin ? "Odbierz superadmina" : "Nadaj superadmina"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(a.state === "active" || a.state === "banned") && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm("reset2fa")}>
                    Resetuj 2FA
                  </DropdownMenuItem>
                )}
                {a.banned ? (
                  <DropdownMenuItem onClick={() => ban.mutate({ userId: a.id, banned: false })}>
                    Odblokuj
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm("ban")}>
                    Zablokuj
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {editing && <EditAccountForm account={a} onDone={() => setEditing(false)} />}
      {a.banned && <BlockedAccountExams userId={a.id} />}
      <ConfirmDialog
        {...confirmProps("reset2fa")}
        title={`Zresetować 2FA: ${a.name}?`}
        description="Usuwa klucze dostępu, aplikację z kodami i zaufane przeglądarki tej osoby oraz ją wylogowuje. Do czasu ponownej konfiguracji drugi sposób może podpiąć każdy, kto zna jej hasło — resetuj dopiero po potwierdzeniu tożsamości poza aplikacją."
        confirmLabel="Resetuj 2FA"
        onConfirm={() => reset2fa.mutateAsync({ userId: a.id })}
      />
      <ConfirmDialog
        {...confirmProps("ban")}
        title={`Zablokować konto: ${a.name}?`}
        description="Ta osoba zostanie wylogowana i nie zaloguje się, dopóki jej nie odblokujesz. Jej zaliczenia zostają."
        confirmLabel="Zablokuj"
        onConfirm={() => ban.mutateAsync({ userId: a.id, banned: true })}
      />
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
