import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"

import { useAppForm } from "@/components/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/messages.pl"
import { changePasswordSchema } from "@/schemas/auth"

export const Route = createFileRoute("/_authed/haslo")({
  head: () => ({ meta: [{ title: "Zmiana hasła — Terminus" }] }),
  component: ChangePassword,
})

function ChangePassword() {
  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "" },
    validators: { onSubmit: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient
        .changePassword({ ...value, revokeOtherSessions: true })
        .catch(() => ({ error: { code: undefined } }))
      if (error) {
        toast.error(authErrorMessage(error.code))
        return
      }
      formApi.reset()
      toast.success("Hasło zmienione.")
    },
  })
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-lg font-extrabold">Zmiana hasła</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className="grid gap-4">
            <form.AppField name="currentPassword">
              {(f) => (
                <f.TextField label="Obecne hasło" type="password" autoComplete="current-password" />
              )}
            </form.AppField>
            <form.AppField name="newPassword">
              {(f) => (
                <f.TextField label="Nowe hasło" type="password" autoComplete="new-password" />
              )}
            </form.AppField>
            <form.SubmitButton>Zmień hasło</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  )
}
