import type { ExamValues } from "@/components/exam-form-values"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Notice } from "@/components/notice"
import { Button } from "@/components/ui/button"
import { EMAIL_LOGIN_UNCONFIGURED } from "@/messages.pl"
import { examFormSchema } from "@/schemas/exam"

export function ExamForm({
  defaultValues,
  submitLabel,
  emailLoginAvailable,
  onSubmit,
}: {
  defaultValues: ExamValues
  submitLabel: string
  /** Podane = pokazuje opcję logowania mailem; `false` = serwer nie ma poczty. */
  emailLoginAvailable?: boolean
  onSubmit: (values: ExamValues) => Promise<unknown>
}) {
  const form = useAppForm({
    defaultValues,
    ...schemaSubmit(examFormSchema, onSubmit),
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
        <form.AppField name="assignmentMode">
          {(field) => (
            <field.ToggleField
              label="Sposób przydziału"
              hint="Losowy: system sam wybiera slot. Ręczny: student wybiera wolny slot na planszy. Dotyczy kolejnych zapisów."
              options={[
                { value: "RANDOM", label: "Losowy" },
                { value: "MANUAL", label: "Ręczny" },
              ]}
            />
          )}
        </form.AppField>
        {emailLoginAvailable !== undefined && (
          <form.Subscribe selector={(s) => s.values.requireEmailLogin}>
            {(checked) => (
              <div className="grid gap-2">
                <form.AppField name="requireEmailLogin">
                  {(field) => (
                    <field.CheckboxField
                      label="Wymagaj logowania mailem"
                      hint="Student loguje się mailem przed wejściem na stronę zapisów."
                      disabled={!emailLoginAvailable && !checked}
                    />
                  )}
                </form.AppField>
                {!emailLoginAvailable && !checked && (
                  <Notice tone="info" role="status">
                    {EMAIL_LOGIN_UNCONFIGURED}
                  </Notice>
                )}
                {!emailLoginAvailable && checked && (
                  <Notice tone="error">
                    Poczta niedostępna: studenci nie wejdą. Wyłącz opcję, żeby otworzyć zapisy.
                  </Notice>
                )}
              </div>
            )}
          </form.Subscribe>
        )}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">
            Start zapisów (puste = od razu po utworzeniu)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <form.AppField name="opensDate">
              {(field) => <field.TextField label="Data" type="date" />}
            </form.AppField>
            <form.AppField name="opensTime">
              {(field) => <field.TextField label="Godzina" type="time" />}
            </form.AppField>
          </div>
        </fieldset>
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
