import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { useAppForm } from "@/components/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/messages.pl"
import { loginSchema, loginSearchSchema } from "@/schemas/auth"
import { getSessionUser } from "@/server/session"

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: "/" })
  },
  head: () => ({ meta: [{ title: "Logowanie — Terminus" }] }),
  component: Login,
})

function Login() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      const { error: authError } = await authClient.signIn
        .email(loginSchema.parse(value))
        .catch(() => ({ error: { code: undefined } }))
      if (authError) {
        setError(authErrorMessage(authError.code))
        return
      }
      await navigate({ href: target ?? "/" })
    },
  })

  return (
    <main className="mx-auto grid min-h-svh max-w-sm content-center p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">Terminus</CardTitle>
          <p className="text-muted-foreground">Zapisy na zaliczenia</p>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form.Form className="grid gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form.AppField name="email">
                {(field) => <field.TextField label="E-mail" type="email" autoComplete="username" />}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField label="Hasło" type="password" autoComplete="current-password" />
                )}
              </form.AppField>
              <form.SubmitButton>Zaloguj się</form.SubmitButton>
            </form.Form>
          </form.AppForm>
        </CardContent>
      </Card>
    </main>
  )
}
