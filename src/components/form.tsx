import { createFormHook, createFormHookContexts, revalidateLogic } from "@tanstack/react-form"
import { useId, useRef, type ReactNode } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import { hasManyRosters } from "@/components/roster-choice"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { firstIssue } from "@/messages.pl"

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
    <p id={id} aria-live="polite" className="text-sm text-destructive">
      {errors.map(issueMessage).join(" ")}
    </p>
  )
}

/** Etykieta (z opcjonalnym przyciskiem obok), kontrolka i komunikat błędu pola `id`. */
function FieldShell({
  id,
  label,
  action,
  children,
}: {
  id: string
  label: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      {action ? (
        <div className="flex items-baseline justify-between">
          <Label htmlFor={id}>{label}</Label>
          {action}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {children}
      <FieldErrors id={`${id}-errors`} />
    </div>
  )
}

type TextFieldProps = {
  label: string
  type?: "text" | "email" | "password" | "date" | "time"
  autoComplete?: string
  multiline?: boolean
  inputMode?: "numeric"
  /** Błąd spoza walidacji formularza (np. indeks wskazany przez serwer). */
  invalid?: boolean
  /** Przycisk obok etykiety (np. „Usuń” przy osobie w zespole). */
  action?: ReactNode
  className?: string
  autoFocus?: boolean
}

function TextField({
  label,
  type = "text",
  autoComplete,
  multiline,
  inputMode,
  invalid,
  action,
  className,
  autoFocus,
}: TextFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const props = {
    id,
    name: field.name,
    value: field.state.value,
    onBlur: field.handleBlur,
    "aria-invalid": invalid || field.state.meta.errors.length > 0 || undefined,
    "aria-describedby": `${id}-errors`,
    className,
    autoFocus,
  }
  return (
    <FieldShell id={id} label={label} action={action}>
      {multiline ? (
        <Textarea {...props} onChange={(e) => field.handleChange(e.target.value)} />
      ) : (
        <Input
          {...props}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      )}
    </FieldShell>
  )
}

function NumberField({ label, min, max }: { label: string; min?: number; max?: number }) {
  const field = useFieldContext<number>()
  const id = useId()
  return (
    <FieldShell id={id} label={label}>
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
    </FieldShell>
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
    <FieldShell id={id} label={label}>
      <Select
        name={field.name}
        items={options}
        value={field.state.value}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <SelectTrigger
          id={id}
          onBlur={field.handleBlur}
          aria-invalid={field.state.meta.errors.length > 0 || undefined}
          aria-describedby={`${id}-errors`}
          className="h-9 w-full bg-card"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

function ToggleField({
  label,
  hint,
  options,
}: {
  label: string
  hint?: string
  options: { value: string; label: string }[]
}) {
  const field = useFieldContext<string>()
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label id={id}>{label}</Label>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        value={[field.state.value]}
        // Kliknięcie wybranej opcji zwraca pustą tablicę; zostaje poprzednia wartość.
        onValueChange={(v) => v[0] && field.handleChange(v[0])}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

function RosterField({ rosters }: { rosters: { id: string; name: string }[] }) {
  if (!hasManyRosters(rosters)) return null
  return (
    <SelectField label="Lista" options={rosters.map((r) => ({ value: r.id, label: r.name }))} />
  )
}

function CheckboxField({
  label,
  hint,
  disabled,
}: {
  label: string
  hint?: string
  disabled?: boolean
}) {
  const field = useFieldContext<boolean>()
  const id = useId()
  return (
    <div className={`flex gap-2 ${hint ? "items-start" : "items-center"}`}>
      <Checkbox
        id={id}
        checked={field.state.value}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={hint ? "mt-1" : undefined}
        onCheckedChange={(checked) => field.handleChange(checked)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className={hint ? "font-semibold" : "font-normal"}>
          {label}
        </Label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

/** Po nieudanym wysłaniu fokus idzie do pierwszego błędnego pola (po przerysowaniu z `aria-invalid`). */
function Form({ className, children }: { className?: string; children: React.ReactNode }) {
  const form = useFormContext()
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={async (e) => {
        e.preventDefault()
        if (form.state.isSubmitting) return
        // Odrzucenie (sieć, wyjątek serwera) pokazała już mutacja; bez catch zostaje nieobsłużony błąd.
        await form.handleSubmit().catch(() => {})
        if (form.state.isValid) return
        requestAnimationFrame(() =>
          ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        )
      }}
    >
      {children}
    </form>
  )
}

function SubmitButton({
  children,
  disabled,
  className,
  size,
}: {
  children: React.ReactNode
  disabled?: boolean
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting || disabled} className={className} size={size}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    NumberField,
    SelectField,
    ToggleField,
    RosterField,
    CheckboxField,
  },
  formComponents: { Form, SubmitButton },
})

/** Walidacja przy pierwszym wysłaniu, potem przy każdej zmianie — poprawione pole od razu traci błąd. */
export const submitThenChange = <T,>(schema: T) => ({
  validationLogic: revalidateLogic(),
  validators: { onDynamic: schema },
})

/**
 * Walidacja i wysyłka formularza jednym schematem — do rozłożenia w `useAppForm({ defaultValues, ...schemaSubmit(...) })`.
 * `prepare` poprawia wartości przed wysłaniem (np. lista usunięta w innej karcie); jeśli po nim schemat
 * odrzuca dane, komunikat idzie do toastu zamiast wyjątku. `resetOnOk` czyści formularz po `{ ok: true }`.
 */
export function schemaSubmit<In, Out>(
  schema: z.ZodType<Out, In>,
  submit: (data: Out) => Promise<unknown>,
  { prepare, resetOnOk }: { prepare?: (value: In) => In; resetOnOk?: boolean } = {},
) {
  return {
    ...submitThenChange(schema),
    onSubmit: async ({ value, formApi }: { value: In; formApi: { reset: () => void } }) => {
      const parsed = schema.safeParse(prepare ? prepare(value) : value)
      if (!parsed.success) {
        toast.error(firstIssue(parsed.error))
        return
      }
      const result = await submit(parsed.data)
      if (resetOnOk && typeof result === "object" && result !== null && "ok" in result && result.ok)
        formApi.reset()
    },
  }
}
