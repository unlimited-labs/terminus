import { useState } from "react"

import { hasManyRosters, rosterNames } from "@/components/roster-choice"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { fullName, isFreeSlot } from "@/domain/schedule"
import {
  formatDay,
  formatDayShort,
  formatSlotTime,
  slotNumber,
  slotNumbering,
  warsawDay,
  warsawTime,
  type SlotNumbering,
} from "@/domain/time"
import type { Schedule } from "@/server/schedule"

type Slot = Schedule["slots"][number]

const HOUR = 3_600_000
const MIN_SLOT_PX = 40

/** Rodzaj kafelka: kolor, tekst w kafelku i nazwa dla czytnika ekranu. */
const KINDS = {
  mine: {
    tone: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
    text: (n: string) => `Twój: ${n}`,
    a11y: "Twój slot",
  },
  taken: { tone: "bg-taken hover:bg-taken/80", text: (n: string) => n, a11y: "zajęty" },
  free: { tone: "border-2 border-free bg-card text-free", text: () => "wolny", a11y: "wolny" },
  past: { tone: "bg-card text-muted-foreground", text: () => "", a11y: "miniony" },
}
type Kind = keyof typeof KINDS

const PICKED_TONE = "border-2 border-primary bg-primary text-primary-foreground"

const PRESSED =
  "border bg-card data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"

const isFree = (s: Slot, now: Date) => isFreeSlot(s, s.team.length > 0, now)

/** „Twój” tylko gdy w slocie widać już zespół (plansza mogła się jeszcze nie odświeżyć po zapisie). */
function slotKind(slot: Slot, now: Date, mine: boolean): Kind {
  if (slot.team.length > 0) return mine ? "mine" : "taken"
  return slot.startsAt > now ? "free" : "past"
}

/** `pulse`: plansza startuje na dniu „Twojego” slotu, bez filtra listy, a kafelek pulsuje. */
export function ScheduleBoard({
  schedule,
  mySlotId,
  pulse,
  pickedSlotId = null,
  onPick,
}: {
  schedule: Schedule
  mySlotId: string | null
  pulse: boolean
  pickedSlotId?: string | null
  onPick?: (slot: Slot) => void
}) {
  const shown = pulse ? schedule.slots.find((s) => s.id === mySlotId) : undefined
  const [rosterId, setRosterId] = useState<string | null>(null)
  const [chosenDay, setChosenDay] = useState(shown ? warsawDay(shown.startsAt) : null)
  const multi = hasManyRosters(schedule.rosters)
  const visible = schedule.slots.filter((s) => rosterId === null || s.rosterId === rosterId)
  const days = [...Map.groupBy(visible, (s) => warsawDay(s.startsAt))]
  const firstFree = Math.max(
    0,
    days.findIndex(([, slots]) => slots.some((s) => isFree(s, schedule.now))),
  )
  const [dayKey, day = []] = days.find(([d]) => d === chosenDay) ?? days[firstFree] ?? []
  // Numer z pełnej listy slotów, nie z przefiltrowanej listą indeksów.
  const numbering = slotNumbering(schedule)
  const dayProps: DayProps = {
    slots: day,
    now: schedule.now,
    mySlotId,
    pulse,
    pickedSlotId,
    onPick,
    rosterName: multi ? rosterNames(schedule.rosters) : null,
  }

  return (
    <section aria-label="Harmonogram" className="grid gap-3">
      {multi && (
        <ToggleGroup
          aria-label="Lista"
          value={[rosterId ?? ""]}
          onValueChange={([next]) => next !== undefined && setRosterId(next || null)}
          className="flex-wrap"
        >
          {[{ id: "", name: "Wszystkie" }, ...schedule.rosters].map((r) => (
            <ToggleGroupItem key={r.id} value={r.id} className={`font-semibold ${PRESSED}`}>
              {r.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <Legend />
      {days.length > 1 && (
        <ToggleGroup
          aria-label="Dni"
          value={dayKey ? [dayKey] : []}
          onValueChange={([next]) => next && setChosenDay(next)}
          className="-mx-4 w-auto overflow-x-auto px-4 pb-1"
        >
          {days.map(([d, slots]) => (
            <ToggleGroupItem
              key={d}
              value={d}
              className={`grid h-auto rounded-xl px-4 py-2 text-left ${PRESSED}`}
            >
              <span className="font-bold capitalize">{formatDayShort(slots[0]!.startsAt)}</span>
              <span className="text-xs opacity-80 tabular-nums">
                wolne: {slots.filter((s) => isFree(s, schedule.now)).length}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {day[0] &&
        (numbering ? (
          <DayList {...dayProps} numbering={numbering} />
        ) : (
          <DayTimeline {...dayProps} />
        ))}
    </section>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <i className="size-3.5 rounded border-2 border-free bg-card" /> wolny
      </li>
      <li className="flex items-center gap-1.5">
        <i className="size-3.5 rounded bg-taken" /> zajęty
      </li>
      <li className="flex items-center gap-1.5">
        <i className="size-3.5 rounded bg-primary" /> Twój
      </li>
    </ul>
  )
}

type DayProps = {
  slots: Slot[]
  now: Date
  mySlotId: string | null
  pulse: boolean
  pickedSlotId: string | null
  onPick?: (slot: Slot) => void
  rosterName: Map<string, string> | null
}

function DayHeading({ slots }: { slots: Slot[] }) {
  return (
    <h2 className="text-lg font-extrabold first-letter:uppercase">
      {formatDay(slots[0]!.startsAt)}
    </h2>
  )
}

/** Kafelek slotu dnia; `number` i `box` zależą od widoku (lista albo oś godzin). */
function dayBlock(day: DayProps, slot: Slot, number: number | null, box: Box | null) {
  return (
    <SlotBlock
      key={slot.id}
      slot={slot}
      number={number}
      kind={slotKind(slot, day.now, slot.id === day.mySlotId)}
      pulse={day.pulse && slot.id === day.mySlotId}
      picked={slot.id === day.pickedSlotId}
      onPick={day.onPick}
      rosterName={day.rosterName?.get(slot.rosterId)}
      box={box}
    />
  )
}

/** Bez godzin: zwykła lista slotów równej wysokości z numerami slotów zamiast osi godzin. */
function DayList({ numbering, ...day }: DayProps & { numbering: NonNullable<SlotNumbering> }) {
  return (
    <div className="grid gap-2">
      <DayHeading slots={day.slots} />
      <ul className="grid gap-1.5">
        {day.slots.map((slot) => dayBlock(day, slot, slotNumber(numbering, slot.startsAt), null))}
      </ul>
    </div>
  )
}

function DayTimeline(day: DayProps) {
  const { slots } = day
  const start = Math.floor(slots[0]!.startsAt.getTime() / HOUR) * HOUR
  const end = Math.ceil(slots.at(-1)!.endsAt.getTime() / HOUR) * HOUR
  const shortest = Math.min(...slots.map((s) => s.endsAt.getTime() - s.startsAt.getTime())) / 60_000
  const pxPerMinute = Math.max(2.4, MIN_SLOT_PX / shortest)
  const y = (t: number) => ((t - start) / 60_000) * pxPerMinute
  const hours = Array.from({ length: (end - start) / HOUR + 1 }, (_, i) => start + i * HOUR)

  return (
    <div className="grid gap-2">
      <DayHeading slots={slots} />
      <div className="relative" style={{ height: y(end) }}>
        {hours.map((h) => (
          <div key={h} aria-hidden className="absolute inset-x-0 flex gap-2" style={{ top: y(h) }}>
            <span className="w-11 -translate-y-1/2 text-right text-xs text-muted-foreground tabular-nums">
              {warsawTime(new Date(h))}
            </span>
            <span className="mt-px h-px flex-1 bg-border" />
          </div>
        ))}
        <ul>
          {slots.map((slot) =>
            dayBlock(day, slot, null, {
              top: y(slot.startsAt.getTime()) + 1,
              height: y(slot.endsAt.getTime()) - y(slot.startsAt.getTime()) - 2,
            }),
          )}
        </ul>
      </div>
    </div>
  )
}

/** `number`: numer slotu zamiast godziny; `null` = godzina startu. */
function SlotBody({
  slot,
  number,
  label,
  open,
  rosterName,
}: {
  slot: Slot
  number: number | null
  label: string
  open: boolean
  rosterName?: string
}) {
  return (
    <>
      <span
        className={`shrink-0 font-extrabold tabular-nums ${number === null ? "" : "min-w-[4.2rem]"}`}
      >
        {number === null ? warsawTime(slot.startsAt) : `Slot ${number}`}
      </span>
      <span className={open ? "min-w-0" : "min-w-0 truncate"}>{label}</span>
      {rosterName && <span className="ml-auto shrink-0 text-xs opacity-75">{rosterName}</span>}
    </>
  )
}

/** Położenie kafelka na osi godzin; `null` = zwykły wiersz listy (bez godzin). */
type Box = { top: number; height: number }

function SlotBlock({
  slot,
  number,
  kind,
  pulse,
  picked,
  onPick,
  rosterName,
  box,
}: {
  slot: Slot
  number: number | null
  kind: Kind
  pulse: boolean
  picked: boolean
  onPick?: (slot: Slot) => void
  rosterName?: string
  box: Box | null
}) {
  const [open, setOpen] = useState(false)
  const names = slot.team.map(fullName).join(", ")
  const label = KINDS[kind].text(names)
  const tone = picked ? PICKED_TONE : KINDS[kind].tone
  const at = box ? "absolute right-0 left-14" : "relative min-h-12 w-full py-2"
  const className = `${at} flex gap-3 rounded-lg px-3 text-left text-sm ${tone} ${
    open ? "z-10 items-start py-2 shadow-lg" : "items-center overflow-hidden"
  } ${pulse ? "animate-slot-pulse" : ""}`
  const a11yWhen = number === null ? formatSlotTime(slot) : `slot ${number}`
  const body = (
    <SlotBody slot={slot} number={number} label={label} open={open} rosterName={rosterName} />
  )
  const style = box ? (open ? { top: box.top, minHeight: box.height } : box) : undefined
  const action =
    kind === "free" && onPick
      ? {
          "aria-pressed": picked,
          "aria-label": `${a11yWhen}, wolny`,
          onClick: () => onPick(slot),
        }
      : slot.team.length > 0
        ? {
            "aria-expanded": open,
            "aria-label": `${a11yWhen}, ${KINDS[kind].a11y}: ${names}`,
            onClick: () => setOpen(!open),
          }
        : undefined
  if (!action) {
    return (
      <li>
        <div className={className} style={style}>
          {body}
        </div>
      </li>
    )
  }
  return (
    <li>
      <Button
        variant="ghost"
        {...action}
        className={`h-auto justify-start font-normal whitespace-normal ${className}`}
        style={style}
      >
        {body}
      </Button>
    </li>
  )
}
