import type { z } from "zod"

import { useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
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
        <form.Field name="fields" mode="array">
          {(list) => (
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-semibold">
                Dodatkowe pola dla studenta (wypełnia zespół przy zapisie)
              </legend>
              {list.state.value.map((item, i) => (
                <div key={item.id} className="flex flex-wrap items-start gap-3">
                  <div className="min-w-48 flex-1">
                    <form.AppField name={`fields[${i}].label`}>
                      {(f) => <f.TextField label={`Pole ${i + 1} — nazwa (np. Tytuł projektu)`} />}
                    </form.AppField>
                  </div>
                  <div className="flex items-center gap-3 pt-7">
                    <form.AppField name={`fields[${i}].required`}>
                      {(f) => <f.CheckboxField label="wymagane" />}
                    </form.AppField>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => list.removeValue(i)}
                    >
                      Usuń
                    </Button>
                  </div>
                </div>
              ))}
              {list.state.value.length < 5 && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      list.pushValue({
                        id: crypto.randomUUID().slice(0, 8),
                        label: "",
                        required: false,
                      })
                    }
                  >
                    Dodaj pole
                  </Button>
                </div>
              )}
            </fieldset>
          )}
        </form.Field>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
