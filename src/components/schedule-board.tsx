import { useState } from "react"

import { isFreeSlot } from "@/domain/schedule"
import { formatDayShort, formatDayTime, warsawDay, warsawTime } from "@/domain/time"
import type { Schedule } from "@/server/schedule"

type Slot = Schedule["slots"][number]

const HOUR = 3_600_000
const MIN_SLOT_PX = 40

const TONES = {
  mine: "bg-primary text-primary-foreground",
  taken: "bg-taken",
  free: "border-2 border-free bg-card text-free",
  past: "bg-card text-muted-foreground",
}

function tone(slot: Slot, now: Date, mine: boolean): keyof typeof TONES {
  if (mine) return "mine"
  if (slot.team.length > 0) return "taken"
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
        <div role="group" aria-label="Lista" className="flex flex-wrap gap-2">
          {[{ id: null, name: "Wszystkie" }, ...schedule.rosters].map((r) => (
            <button
              key={r.id ?? "all"}
              type="button"
              aria-pressed={rosterId === r.id}
              onClick={() => setRosterId(r.id)}
              className="rounded-lg border bg-card px-3 py-1 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      <Legend />
      {days.length > 1 && (
        <div role="group" aria-label="Dni" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => (
            <button
              key={warsawDay(d[0]!.startsAt)}
              type="button"
              aria-pressed={d === day}
              onClick={() => setChosenDay(warsawDay(d[0]!.startsAt))}
              className="grid shrink-0 rounded-xl border bg-card px-4 py-2 text-left aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              <span className="font-bold capitalize">{formatDayShort(d[0]!.startsAt)}</span>
              <span className="text-xs opacity-80 tabular-nums">
                wolne: {d.filter((s) => isFreeSlot(s, schedule.now)).length}
              </span>
            </button>
          ))}
        </div>
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

const slotText = (kind: keyof typeof TONES, names: string) =>
  ({ free: "wolny", past: "", mine: `Twój: ${names}`, taken: names })[kind]
const A11Y_KIND = { mine: "Twój slot", taken: "zajęty", free: "wolny", past: "miniony" }

function SlotBlock({
  slot,
  kind,
  pulse,
  rosterName,
  top,
  height,
}: {
  slot: Slot
  kind: keyof typeof TONES
  pulse: boolean
  rosterName?: string
  top: number
  height: number
}) {
  const [open, setOpen] = useState(false)
  const names = slot.team.map((p) => `${p.firstName} ${p.lastName}`).join(", ")
  const label = slotText(kind, names)
  const className = `absolute right-0 left-14 flex gap-3 rounded-lg px-3 text-left text-sm ${TONES[kind]} ${
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
          aria-label={`${warsawTime(slot.startsAt)}–${warsawTime(slot.endsAt)}, ${A11Y_KIND[kind]}: ${names}`}
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
