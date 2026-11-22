import { Link, createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { TicketCard } from "@/components/ticket-card"
import { forgotPasswordSchema } from "@/schemas/auth"
import { forgotPassword, mailAvailable } from "@/server/password-link"
import { PASSWORD_LINK_HOURS } from "@/domain/limits"

export const Route = createFileRoute("/nie-pamietam-hasla")({
  loader: () => mailAvailable(),
  head: () => ({ meta: [{ title: "Nie pamiętam hasła — Terminus" }] }),
  component: ForgotPassword,
})

function ForgotPassword() {
  const available = Route.useLoaderData()
  const [sent, setSent] = useState(false)
  const form = useAppForm({
    defaultValues: { email: "" },
    ...schemaSubmit(forgotPasswordSchema, async (data) => {
      await forgotPassword({ data })
      setSent(true)
    }),
  })
  return (
    <TicketCard subtitle="Nie pamiętam hasła">
      {!available ? (
        <Notice tone="notice">
          Poczta nie jest skonfigurowana. O nowe hasło poproś superadmina.
        </Notice>
      ) : sent ? (
        <Notice tone="info" role="status">
          Jeśli to adres konta prowadzącego, wysłaliśmy na niego link do ustawienia hasła. Link
          działa {PASSWORD_LINK_HOURS} godziny.
        </Notice>
      ) : (
        <form.AppForm>
          <form.Form className="grid gap-4">
            <form.AppField name="email">
              {(f) => (
                <f.TextField
                  label="E-mail"
                  type="email"
                  autoComplete="username"
                  enterKeyHint="go"
                />
              )}
            </form.AppField>
            <form.SubmitButton size="lg">Wyślij link</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      )}
      <Link to="/login" className="justify-self-start text-sm text-muted-foreground underline">
        Wróć do logowania
      </Link>
    </TicketCard>
  )
}
