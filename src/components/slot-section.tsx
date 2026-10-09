import { useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { schemaSubmit, useAppForm } from "@/components/form"
import { currentRosterId, hasManyRosters } from "@/components/roster-choice"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useExamMutation } from "@/components/use-result-mutation"
import { cutWindow } from "@/domain/slots"
import { formatDayShort, formatSlotTime, warsawDay, warsawTime } from "@/domain/time"
import { errorMessage } from "@/messages.pl"
import { updateSlotSchema, windowSchema } from "@/schemas/slot"
import type { ExamDetail } from "@/server/exam-state.server"
import { addSlotWindow, deleteFreeSlotsOfDay, deleteSlot, updateSlot } from "@/server/slots"

type Slot = ExamDetail["slots"][number]
type Person = ExamDetail["people"][number]

export function CapacitySummary({ exam }: { exam: ExamDetail }) {
  const many = hasManyRosters(exam.rosters)
  return (
    <ul className="grid gap-1 text-sm">
      {exam.rosters.map((roster) => {
        const people = exam.people.filter((p) => p.rosterId === roster.id).length
        const places = exam.slots.filter((s) => s.rosterId === roster.id).length * exam.maxTeamSize
        return (
          <li key={roster.id} className={places < people ? "text-destructive" : undefined}>
            {many ? `${roster.name}: ` : ""}
            <span className="tabular-nums">
              indeksy: {people}, miejsca w slotach: {places}
            </span>
            {places < people && " — za mało miejsc!"}
          </li>
        )
      })}
    </ul>
  )
}

export function SlotSection({ exam }: { exam: ExamDetail }) {
  const days = Map.groupBy(exam.slots, (s) => warsawDay(s.startsAt))
  const teams = Map.groupBy(exam.people, (p) => p.slotId)
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-extrabold">Sloty</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {exam.rosters.length === 0 ? (
            <p className="text-muted-foreground">
              Najpierw dodaj listę indeksów — każdy slot należy do listy.
            </p>
          ) : (
            <>
              <WindowForm exam={exam} />
              <CapacitySummary exam={exam} />
            </>
          )}
        </CardContent>
      </Card>
      {days.size > 0 && (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...days].map(([day, slots]) => (
            <Card key={day}>
              <CardContent>
                <DaySlots exam={exam} day={day} slots={slots} teams={teams} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function WindowForm({ exam }: { exam: ExamDetail }) {
  const add = useExamMutation(addSlotWindow, exam.id, ({ count }) =>
    toast.success(`Dodano sloty: ${count}.`),
  )
  const form = useAppForm({
    defaultValues: {
      examId: exam.id,
      rosterId: exam.rosters[0]!.id,
      date: "",
      from: "09:00",
      to: "12:00",
      minutes: exam.defaultSlotMinutes,
    },
    ...schemaSubmit(windowSchema, add.mutateAsync, {
      prepare: (v) => ({ ...v, rosterId: currentRosterId(exam.rosters, v.rosterId) }),
    }),
  })
  return (
    <form.AppForm>
      <form.Form className="grid gap-3">
        <p className="font-semibold">Dodaj okno — aplikacja potnie je na sloty</p>
        <div className="grid items-start gap-3 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
          <form.AppField name="date">
            {(f) => <f.TextField label="Data" type="date" />}
          </form.AppField>
          <form.AppField name="from">{(f) => <f.TextField label="Od" type="time" />}</form.AppField>
          <form.AppField name="to">{(f) => <f.TextField label="Do" type="time" />}</form.AppField>
          <form.AppField name="minutes">
            {(f) => <f.NumberField label="Długość slotu (min)" min={1} max={480} />}
          </form.AppField>
          <form.AppField name="rosterId">
            {(f) => <f.RosterField rosters={exam.rosters} />}
          </form.AppField>
        </div>
        <form.Subscribe selector={(s) => s.values}>
          {(values) => <WindowPreview {...values} />}
        </form.Subscribe>
        <div>
          <form.SubmitButton>Dodaj sloty</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  )
}

function WindowPreview({
  date,
  from,
  to,
  minutes,
}: {
  date: string
  from: string
  to: string
  minutes: number
}) {
  if (!date || !from || !to || !(minutes >= 1)) return null
  const cut = cutWindow({ date, from, to, minutes })
  if (!cut.ok) {
    return <p className="text-sm text-destructive">{errorMessage(cut)}</p>
  }
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      Sloty ({cut.slots.length}): {cut.slots.map((s) => warsawTime(s.startsAt)).join(", ")}
      {cut.unusedMinutes > 0 && ` · niewykorzystane minuty: ${cut.unusedMinutes}`}
    </p>
  )
}

function DaySlots({
  exam,
  day,
  slots,
  teams,
}: {
  exam: ExamDetail
  day: string
  slots: Slot[]
  teams: Map<string | null, Person[]>
}) {
  const label = formatDayShort(slots[0]!.startsAt)
  const removeFree = useExamMutation(deleteFreeSlotsOfDay, exam.id, ({ deleted, skipped }) =>
    toast.success(
      `Usunięto wolne sloty: ${deleted}.${skipped > 0 ? ` Pominięto sloty z zapisami: ${skipped}.` : ""}`,
    ),
  )
  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-3 border-b pb-1">
        <h3 className="font-bold capitalize">{label}</h3>
        <span className="ml-auto">
          <ConfirmButton
            title="Usunąć wolne sloty tego dnia?"
            description={`${label}: znikną wszystkie sloty bez zapisów. Sloty z zapisami zostaną.`}
            confirmLabel="Usuń wolne sloty"
            onConfirm={() => removeFree.mutateAsync({ examId: exam.id, day })}
          >
            usuń wolne sloty
          </ConfirmButton>
        </span>
      </div>
      <ul className="grid gap-1">
        {slots.map((slot) => (
          <SlotListItem key={slot.id} exam={exam} slot={slot} team={teams.get(slot.id) ?? []} />
        ))}
      </ul>
    </section>
  )
}

function SlotListItem({ exam, slot, team }: { exam: ExamDetail; slot: Slot; team: Person[] }) {
  const [editing, setEditing] = useState(false)
  const remove = useExamMutation(deleteSlot, exam.id)
  const roster = exam.rosters.find((r) => r.id === slot.rosterId)

  if (editing) return <SlotEditForm exam={exam} slot={slot} onDone={() => setEditing(false)} />
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 py-0.5 text-sm">
      <span className="grid">
        <span className="font-semibold tabular-nums">{formatSlotTime(slot)}</span>
        {hasManyRosters(exam.rosters) && (
          <span className="text-xs text-muted-foreground">{roster?.name}</span>
        )}
      </span>
      {team.length ? (
        <span className="grid min-w-0">
          {team.map((p) => (
            <span key={p.studentNumber}>
              {p.firstName} {p.lastName}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-free">wolny</span>
      )}
      <span className="flex gap-1">
        <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
          Edytuj
        </Button>
        <ConfirmButton
          title="Usunąć slot?"
          description={`${formatDayShort(slot.startsAt)} ${formatSlotTime(slot)}`}
          confirmLabel="Usuń slot"
          disabled={team.length > 0}
          onConfirm={() => remove.mutateAsync({ examId: exam.id, slotId: slot.id })}
        >
          Usuń
        </ConfirmButton>
      </span>
    </li>
  )
}

function SlotEditForm({
  exam,
  slot,
  onDone,
}: {
  exam: ExamDetail
  slot: Slot
  onDone: () => void
}) {
  const update = useExamMutation(updateSlot, exam.id, onDone)
  const form = useAppForm({
    defaultValues: {
      examId: exam.id,
      slotId: slot.id,
      rosterId: slot.rosterId,
      date: warsawDay(slot.startsAt),
      from: warsawTime(slot.startsAt),
      to: warsawTime(slot.endsAt),
    },
    ...schemaSubmit(updateSlotSchema, update.mutateAsync),
  })
  return (
    <li>
      <form.AppForm>
        <form.Form className="grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]">
          <form.AppField name="date">
            {(f) => <f.TextField label="Data" type="date" />}
          </form.AppField>
          <form.AppField name="from">{(f) => <f.TextField label="Od" type="time" />}</form.AppField>
          <form.AppField name="to">{(f) => <f.TextField label="Do" type="time" />}</form.AppField>
          <form.AppField name="rosterId">
            {(f) => <f.RosterField rosters={exam.rosters} />}
          </form.AppField>
          <div className="flex gap-2">
            <form.SubmitButton>Zapisz</form.SubmitButton>
            <Button type="button" variant="outline" onClick={onDone}>
              Anuluj
            </Button>
          </div>
        </form.Form>
      </form.AppForm>
    </li>
  )
}
