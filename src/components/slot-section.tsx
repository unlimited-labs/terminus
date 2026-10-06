import { useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/confirm-button"
import { useAppForm } from "@/components/form"
import { currentRosterId } from "@/components/roster-choice"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useResultMutation } from "@/components/use-result-mutation"
import { cutWindow } from "@/domain/slots"
import { formatDayShort, warsawDay, warsawTime } from "@/domain/time"
import { errorMessage } from "@/messages.pl"
import { updateSlotSchema, windowSchema } from "@/schemas/slot"
import type { ExamDetail } from "@/server/exam-state.server"
import { addSlotWindow, deleteFreeSlotsOfDay, deleteSlot, updateSlot } from "@/server/slots"
import { examChangeKeys } from "@/server/exams"

type Slot = ExamDetail["slots"][number]

export function SlotSection({ exam }: { exam: ExamDetail }) {
  const days = Map.groupBy(exam.slots, (s) => warsawDay(s.startsAt))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-extrabold">
          Sloty{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({exam.slots.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        {exam.rosters.length === 0 ? (
          <p className="text-muted-foreground">
            Najpierw dodaj listę indeksów — każdy slot należy do listy.
          </p>
        ) : (
          <WindowForm exam={exam} />
        )}
        {[...days].map(([day, slots]) => (
          <DaySlots key={day} exam={exam} day={day} slots={slots} />
        ))}
      </CardContent>
    </Card>
  )
}

function WindowForm({ exam }: { exam: ExamDetail }) {
  const add = useResultMutation(addSlotWindow, examChangeKeys(exam.id), ({ count }) =>
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
    validators: { onSubmit: windowSchema },
    onSubmit: ({ value }) => {
      const rosterId = currentRosterId(exam.rosters, value.rosterId)
      return add.mutateAsync(windowSchema.parse({ ...value, rosterId }))
    },
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

function DaySlots({ exam, day, slots }: { exam: ExamDetail; day: string; slots: Slot[] }) {
  const removeFree = useResultMutation(
    deleteFreeSlotsOfDay,
    examChangeKeys(exam.id),
    ({ deleted, skipped }) =>
      toast.success(
        `Usunięto wolne sloty: ${deleted}.${skipped > 0 ? ` Pominięto sloty z zapisami: ${skipped}.` : ""}`,
      ),
  )
  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-3 border-b pb-1">
        <h3 className="font-bold capitalize">{formatDayShort(slots[0]!.startsAt)}</h3>
        <span className="ml-auto">
          <ConfirmButton
            title="Usunąć wolne sloty tego dnia?"
            description={`${formatDayShort(slots[0]!.startsAt)}: znikną wszystkie sloty bez zapisów. Sloty z zapisami zostaną.`}
            confirmLabel="Usuń wolne sloty"
            onConfirm={() => removeFree.mutateAsync({ examId: exam.id, day })}
          >
            usuń wolne sloty
          </ConfirmButton>
        </span>
      </div>
      <ul className="grid gap-1">
        {slots.map((slot) => (
          <SlotListItem key={slot.id} exam={exam} slot={slot} />
        ))}
      </ul>
    </section>
  )
}

function SlotListItem({ exam, slot }: { exam: ExamDetail; slot: Slot }) {
  const [editing, setEditing] = useState(false)
  const team = exam.people.filter((p) => p.slotId === slot.id)
  const remove = useResultMutation(deleteSlot, examChangeKeys(exam.id))
  const roster = exam.rosters.find((r) => r.id === slot.rosterId)

  if (editing) return <SlotEditForm exam={exam} slot={slot} onDone={() => setEditing(false)} />
  return (
    <li className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-semibold tabular-nums">
        {warsawTime(slot.startsAt)}–{warsawTime(slot.endsAt)}
      </span>
      {exam.rosters.length > 1 && <span className="text-muted-foreground">{roster?.name}</span>}
      <span className={team.length ? "" : "text-free"}>
        {team.length ? team.map((p) => `${p.firstName} ${p.lastName}`).join(", ") : "wolny"}
      </span>
      <span className="ml-auto flex gap-1">
        <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
          Edytuj
        </Button>
        <ConfirmButton
          title="Usunąć slot?"
          description={`${formatDayShort(slot.startsAt)} ${warsawTime(slot.startsAt)}–${warsawTime(slot.endsAt)}`}
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
  const update = useResultMutation(updateSlot, examChangeKeys(exam.id), onDone)
  const form = useAppForm({
    defaultValues: {
      examId: exam.id,
      slotId: slot.id,
      rosterId: slot.rosterId,
      date: warsawDay(slot.startsAt),
      from: warsawTime(slot.startsAt),
      to: warsawTime(slot.endsAt),
    },
    validators: { onSubmit: updateSlotSchema },
    onSubmit: ({ value }) => update.mutateAsync(updateSlotSchema.parse(value)),
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
