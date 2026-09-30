import { createFormHook, createFormHookContexts } from "@tanstack/react-form"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

const issueMessage = (e: unknown) =>
  typeof e === "object" && e !== null && "message" in e ? String(e.message) : String(e)

function FieldErrors({ id }: { id: string }) {
  const field = useFieldContext<unknown>()
  const errors =
    field.state.meta.isTouched || field.form.state.submissionAttempts > 0
      ? field.state.meta.errors
      : []
  if (errors.length === 0) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {errors.map(issueMessage).join(" ")}
    </p>
  )
}

type TextFieldProps = {
  label: string
  type?: "text" | "email" | "password" | "date" | "time"
  autoComplete?: string
  multiline?: boolean
}

function TextField({ label, type = "text", autoComplete, multiline }: TextFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const props = {
    id,
    name: field.name,
    value: field.state.value,
    onBlur: field.handleBlur,
    "aria-invalid": field.state.meta.errors.length > 0 || undefined,
    "aria-describedby": `${id}-errors`,
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea {...props} onChange={(e) => field.handleChange(e.target.value)} />
      ) : (
        <Input
          {...props}
          type={type}
          autoComplete={autoComplete}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      )}
      <FieldErrors id={`${id}-errors`} />
    </div>
  )
}

function NumberField({ label, min, max }: { label: string; min?: number; max?: number }) {
  const field = useFieldContext<number>()
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={field.name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(field.state.value) ? "" : field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.valueAsNumber)}
        aria-invalid={field.state.meta.errors.length > 0 || undefined}
        aria-describedby={`${id}-errors`}
        className="tabular-nums"
      />
      <FieldErrors id={`${id}-errors`} />
    </div>
  )
}

function SelectField({
  label,
  options,
}: {
  label: string
  options: { value: string; label: string }[]
}) {
  const field = useFieldContext<string>()
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldErrors id={`${id}-errors`} />
    </div>
  )
}

function RosterField({ rosters }: { rosters: { id: string; name: string }[] }) {
  if (rosters.length < 2) return null
  return (
    <SelectField label="Lista" options={rosters.map((r) => ({ value: r.id, label: r.name }))} />
  )
}

function CheckboxField({ label }: { label: string }) {
  const field = useFieldContext<boolean>()
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={field.state.value}
        onChange={(e) => field.handleChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}

function Form({ className, children }: { className?: string; children: React.ReactNode }) {
  const form = useFormContext()
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      {children}
    </form>
  )
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, NumberField, SelectField, RosterField, CheckboxField },
  formComponents: { Form, SubmitButton },
})
