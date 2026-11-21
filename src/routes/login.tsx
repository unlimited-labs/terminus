import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { submitThenChange, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { authClient, authFailure } from "@/lib/auth-client"
import { loginSchema, loginSearchSchema } from "@/schemas/auth"
import { sessionQuery } from "@/server/session"

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.query(sessionQuery())) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: "Logowanie — Terminus" }] }),
  component: Login,
})

function Login() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  const { queryClient } = Route.useRouteContext()
  const [error, setError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    ...submitThenChange(loginSchema),
    onSubmit: async ({ value }) => {
      const failure = await authFailure(authClient.signIn.email(loginSchema.parse(value)))
      setError(failure)
      if (failure) return
      // Po wygaśnięciu sesji w tej karcie może się zalogować ktoś inny; klucze zapytań nie zawierają użytkownika.
      queryClient.clear()
      await navigate({ href: target ?? "/" })
    },
  })

  return (
    <main className="mx-auto grid min-h-svh max-w-sm content-center gap-5 p-4">
      <div className="drop-shadow-[0_6px_14px_rgb(29_27_58/0.08)]">
        <header className="ticket-head rounded-t-xl bg-linear-160 from-[#4b3fd6] to-[#6d5bff] px-6 pt-7 pb-6 text-white">
          <h1 className="text-4xl leading-none font-extrabold tracking-tight">Terminus</h1>
          <p className="mt-2 text-lg opacity-90">Zapisy na zaliczenia</p>
        </header>
        <div className="ticket-stub rounded-b-xl bg-card px-6 pt-7 pb-6">
          <form.AppForm>
            <form.Form className="grid gap-4">
              {error && <Notice tone="error">{error}</Notice>}
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    label="E-mail"
                    type="email"
                    autoComplete="username"
                    enterKeyHint="next"
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField
                    label="Hasło"
                    type="password"
                    autoComplete="current-password"
                    enterKeyHint="go"
                  />
                )}
              </form.AppField>
              <form.SubmitButton size="lg" className="mt-1">
                Zaloguj się
              </form.SubmitButton>
            </form.Form>
          </form.AppForm>
        </div>
      </div>
      <p className="px-2 text-center text-sm text-muted-foreground">
        Logowanie jest dla prowadzących. Studenci zapisują się przez link do zaliczenia.
      </p>
    </main>
  )
}
