import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { submitThenChange, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { TicketCard } from "@/components/ticket-card"
import { authClient, authFailure } from "@/lib/auth-client"
import { newPasswordSchema } from "@/schemas/auth"
import { passwordLink } from "@/server/password-link"

export const Route = createFileRoute("/nowe-haslo")({
  validateSearch: z.object({ token: z.string().max(200).catch("") }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => (deps.token ? passwordLink({ data: { token: deps.token } }) : null),
  head: () => ({ meta: [{ title: "Hasło — Terminus" }] }),
  component: NewPassword,
})

function NewPassword() {
  const link = Route.useLoaderData()
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { newPassword: "" },
    ...submitThenChange(newPasswordSchema),
    onSubmit: async ({ value }) => {
      const { newPassword } = newPasswordSchema.parse(value)
      const failure = await authFailure(authClient.resetPassword({ newPassword, token }))
      setError(failure)
      if (!failure) await navigate({ to: "/login", search: { haslo: "ustawione" } })
    },
  })

  if (!link)
    return (
      <TicketCard subtitle="Hasło">
        <Notice tone="error">Link wygasł albo został już użyty.</Notice>
        <Link to="/nie-pamietam-hasla" className="justify-self-start text-sm underline">
          Wyślij nowy link
        </Link>
      </TicketCard>
    )

  return (
    <TicketCard subtitle={link.invited ? "Witaj w Terminusie" : "Nowe hasło"}>
      <form.AppForm>
        <form.Form className="grid gap-4">
          {error && <Notice tone="error">{error}</Notice>}
          <p className="text-sm">
            {link.invited
              ? `${link.name}, ustaw hasło do konta ${link.email}. Potem zabezpieczysz logowanie drugim sposobem.`
              : `Nowe hasło do konta ${link.email}.`}
          </p>
          <input type="email" autoComplete="username" value={link.email} readOnly hidden />
          <form.AppField name="newPassword">
            {(f) => (
              <f.TextField
                label="Nowe hasło"
                type="password"
                autoComplete="new-password"
                enterKeyHint="go"
              />
            )}
          </form.AppField>
          <form.SubmitButton size="lg">Ustaw hasło</form.SubmitButton>
        </form.Form>
      </form.AppForm>
    </TicketCard>
  )
}
