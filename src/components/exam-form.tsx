import type { z } from "zod"

import { useAppForm } from "@/components/form"
import { examSchema } from "@/schemas/exam"

type ExamValues = z.infer<typeof examSchema>

export function ExamForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  defaultValues: ExamValues
  submitLabel: string
  onSubmit: (values: ExamValues) => Promise<unknown>
}) {
  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: examSchema },
    onSubmit: ({ value }) => onSubmit(examSchema.parse(value)),
  })
  return (
    <form.AppForm>
      <form.Form className="grid gap-4">
        <form.AppField name="name">
          {(field) => <field.TextField label="Nazwa (z nazwą przedmiotu)" />}
        </form.AppField>
        <form.AppField name="description">
          {(field) => <field.TextField label="Opis i miejsce" multiline />}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField name="defaultSlotMinutes">
            {(field) => (
              <field.NumberField label="Domyślna długość slotu (min)" min={1} max={480} />
            )}
          </form.AppField>
          <form.AppField name="maxTeamSize">
            {(field) => (
              <field.NumberField
                label="Maks. wielkość zespołu (1 = indywidualne)"
                min={1}
                max={20}
              />
            )}
          </form.AppField>
        </div>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
