import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"

import { schemaSubmit, useAppForm } from "@/components/form"
import { SectionCard } from "@/components/section-card"
import { authClient, authWithToast } from "@/lib/auth-client"
import { changePasswordSchema } from "@/schemas/auth"

export const Route = createFileRoute("/_authed/haslo")({
  head: () => ({ meta: [{ title: "Zmiana hasła — Terminus" }] }),
  component: ChangePassword,
})

function ChangePassword() {
  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "" },
    ...schemaSubmit(
      changePasswordSchema,
      async (data) => {
        const ok = await authWithToast(
          authClient.changePassword({ ...data, revokeOtherSessions: true }),
        )
        if (ok) toast.success("Hasło zmienione.")
        return { ok }
      },
      { resetOnOk: true },
    ),
  })
  return (
    <SectionCard title="Zmiana hasła" className="mx-auto max-w-md">
      <form.AppForm>
        <form.Form className="grid gap-4">
          <form.AppField name="currentPassword">
            {(f) => (
              <f.TextField label="Obecne hasło" type="password" autoComplete="current-password" />
            )}
          </form.AppField>
          <form.AppField name="newPassword">
            {(f) => <f.TextField label="Nowe hasło" type="password" autoComplete="new-password" />}
          </form.AppField>
          <form.SubmitButton>Zmień hasło</form.SubmitButton>
        </form.Form>
      </form.AppForm>
    </SectionCard>
  )
}
