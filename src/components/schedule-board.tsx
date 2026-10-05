import { useState } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { isFreeSlot } from "@/domain/schedule"
import { formatDayShort, formatDayTime, warsawDay, warsawTime } from "@/domain/time"
import type { Schedule } from "@/server/schedule"

type Slot = Schedule["slots"][number]

const HOUR = 3_600_000
const MIN_SLOT_PX = 40

/** Rodzaj kafelka: kolor, tekst w kafelku i nazwa dla czytnika ekranu. */
const KINDS = {
  mine: {
    tone: "bg-primary text-primary-foreground",
    text: (n: string) => `Twój: ${n}`,
    a11y: "Twój slot",
  },
  taken: { tone: "bg-taken", text: (n: string) => n, a11y: "zajęty" },
  free: { tone: "border-2 border-free bg-card text-free", text: () => "wolny", a11y: "wolny" },
  past: { tone: "bg-card text-muted-foreground", text: () => "", a11y: "miniony" },
}
type Kind = keyof typeof KINDS

const PRESSED =
  "border bg-card data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"

/** „Twój” tylko gdy w slocie widać już zespół (plansza mogła się jeszcze nie odświeżyć po zapisie). */
function tone(slot: Slot, now: Date, mine: boolean): Kind {
  if (slot.team.length > 0) return mine ? "mine" : "taken"
  return isFreeSlot(slot, now) ? "free" : "past"
}

/** `pulse`: plansza startuje na dniu „Twojego” slotu, bez filtra listy, a kafelek pulsuje. */
export function ScheduleBoard({
  schedule,
  mySlotId,
  pulse,
}: {
  schedule: Schedule
  mySlotId: string | null
  pulse: boolean
}) {
  const shown = pulse ? schedule.slots.find((s) => s.id === mySlotId) : undefined
  const [rosterId, setRosterId] = useState<string | null>(null)
  const [chosenDay, setChosenDay] = useState(shown ? warsawDay(shown.startsAt) : null)
  const multi = schedule.rosters.length > 1
  const visible = schedule.slots.filter((s) => rosterId === null || s.rosterId === rosterId)
  const days = [...Map.groupBy(visible, (s) => warsawDay(s.startsAt)).values()]
  const firstFree = Math.max(
    0,
    days.findIndex((d) => d.some((s) => isFreeSlot(s, schedule.now))),
  )
  const day = days.find((d) => warsawDay(d[0]!.startsAt) === chosenDay) ?? days[firstFree] ?? []

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
          value={day[0] ? [warsawDay(day[0].startsAt)] : []}
          onValueChange={([next]) => next && setChosenDay(next)}
          className="-mx-4 w-auto overflow-x-auto px-4 pb-1"
        >
          {days.map((d) => (
            <ToggleGroupItem
              key={warsawDay(d[0]!.startsAt)}
              value={warsawDay(d[0]!.startsAt)}
              className={`grid h-auto rounded-xl px-4 py-2 text-left ${PRESSED}`}
            >
              <span className="font-bold capitalize">{formatDayShort(d[0]!.startsAt)}</span>
              <span className="text-xs opacity-80 tabular-nums">
                wolne: {d.filter((s) => isFreeSlot(s, schedule.now)).length}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {day[0] && (
        <DayTimeline
          slots={day}
          now={schedule.now}
          mySlotId={mySlotId}
          pulse={pulse}
          rosterName={multi ? new Map(schedule.rosters.map((r) => [r.id, r.name])) : null}
        />
      )}
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

function DayTimeline({
  slots,
  now,
  mySlotId,
  pulse,
  rosterName,
}: {
  slots: Slot[]
  now: Date
  mySlotId: string | null
  pulse: boolean
  rosterName: Map<string, string> | null
}) {
  const start = Math.floor(slots[0]!.startsAt.getTime() / HOUR) * HOUR
  const end = Math.ceil(slots.at(-1)!.endsAt.getTime() / HOUR) * HOUR
  const shortest = Math.min(...slots.map((s) => s.endsAt.getTime() - s.startsAt.getTime())) / 60_000
  const pxPerMinute = Math.max(2.4, MIN_SLOT_PX / shortest)
  const y = (t: number) => ((t - start) / 60_000) * pxPerMinute
  const hours = Array.from({ length: (end - start) / HOUR + 1 }, (_, i) => start + i * HOUR)

  return (
    <div className="grid gap-2">
      <h2 className="text-lg font-extrabold first-letter:uppercase">
        {formatDayTime(slots[0]!.startsAt).split(",")[0]}
      </h2>
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
          {slots.map((slot) => (
            <SlotBlock
              key={slot.id}
              slot={slot}
              kind={tone(slot, now, slot.id === mySlotId)}
              pulse={pulse && slot.id === mySlotId}
              rosterName={rosterName?.get(slot.rosterId)}
              top={y(slot.startsAt.getTime()) + 1}
              height={y(slot.endsAt.getTime()) - y(slot.startsAt.getTime()) - 2}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

function SlotBlock({
  slot,
  kind,
  pulse,
  rosterName,
  top,
  height,
}: {
  slot: Slot
  kind: Kind
  pulse: boolean
  rosterName?: string
  top: number
  height: number
}) {
  const [open, setOpen] = useState(false)
  const names = slot.team.map((p) => `${p.firstName} ${p.lastName}`).join(", ")
  const label = KINDS[kind].text(names)
  const className = `absolute right-0 left-14 flex gap-3 rounded-lg px-3 text-left text-sm ${KINDS[kind].tone} ${
    open ? "z-10 items-start py-2 shadow-lg" : "items-center overflow-hidden"
  } ${pulse ? "animate-slot-pulse" : ""}`
  const body = (
    <>
      <span className="font-extrabold tabular-nums">{warsawTime(slot.startsAt)}</span>
      <span className={open ? "min-w-0" : "min-w-0 truncate"}>{label}</span>
      {rosterName && <span className="ml-auto shrink-0 text-xs opacity-75">{rosterName}</span>}
    </>
  )
  const style = open ? { top, minHeight: height } : { top, height }
  return (
    <li>
      {slot.team.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${warsawTime(slot.startsAt)}–${warsawTime(slot.endsAt)}, ${KINDS[kind].a11y}: ${names}`}
          onClick={() => setOpen(!open)}
          className={className}
          style={style}
        >
          {body}
        </button>
      ) : (
        <div className={className} style={style}>
          {body}
        </div>
      )}
    </li>
  )
}
