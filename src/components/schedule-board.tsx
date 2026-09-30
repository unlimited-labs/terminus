import { useCallback, useState } from "react"

import { isFreeSlot } from "@/domain/schedule"
import { formatDayShort, warsawDay, warsawTime } from "@/domain/time"
import type { Schedule } from "@/server/schedule"

type Slot = Schedule["slots"][number]

export function ScheduleBoard({
  schedule,
  mySlotId,
  pulse,
}: {
  schedule: Schedule
  mySlotId: string | null
  pulse: boolean
}) {
  const [rosterId, setRosterId] = useState<string | null>(null)
  const multi = schedule.rosters.length > 1
  const rosterName = new Map(schedule.rosters.map((r) => [r.id, r.name]))
  const visible = schedule.slots.filter((s) => rosterId === null || s.rosterId === rosterId)
  const days = [...Map.groupBy(visible, (s) => warsawDay(s.startsAt)).values()]
  const firstFreeDay = days.findIndex((d) => d.some((s) => isFreeSlot(s, schedule.now)))

  const scrollToFirstFree = useCallback((el: HTMLDivElement | null) => {
    const target = el?.querySelector<HTMLElement>("[data-first-free]")
    if (el && target) el.scrollLeft = target.offsetLeft - el.offsetLeft
  }, [])

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
      <div ref={scrollToFirstFree} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {days.map((slots, i) => (
          <div
            key={warsawDay(slots[0]!.startsAt)}
            data-first-free={i === firstFreeDay || undefined}
            className="w-36 shrink-0 snap-start"
          >
            <h3 className="mb-2 text-sm font-bold capitalize">
              {formatDayShort(slots[0]!.startsAt)}
            </h3>
            <ul className="grid gap-2">
              {slots.map((slot) => (
                <SlotTile
                  key={slot.id}
                  slot={slot}
                  now={schedule.now}
                  mine={slot.id === mySlotId}
                  pulse={pulse && slot.id === mySlotId}
                  rosterName={multi ? rosterName.get(slot.rosterId) : undefined}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
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

function tileTone(slot: Slot, now: Date, mine: boolean) {
  if (mine) return "bg-primary text-primary-foreground"
  if (slot.team.length > 0) return "bg-taken"
  if (isFreeSlot(slot, now)) return "border-2 border-free bg-card text-free"
  return "bg-card text-muted-foreground"
}

function teamLabel(slot: Slot, now: Date) {
  const [first, ...rest] = slot.team
  if (first) return rest.length > 0 ? `${first.lastName} +${rest.length}` : first.lastName
  return isFreeSlot(slot, now) ? "wolny" : " "
}

function SlotTile({
  slot,
  now,
  mine,
  pulse,
  rosterName,
}: {
  slot: Slot
  now: Date
  mine: boolean
  pulse: boolean
  rosterName?: string
}) {
  const [open, setOpen] = useState(false)
  const className = `block w-full rounded-lg px-2.5 py-2 text-left text-[15px] leading-snug ${tileTone(slot, now, mine)} ${pulse ? "animate-slot-pulse" : ""}`
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-1">
        <span className="font-extrabold tabular-nums">{warsawTime(slot.startsAt)}</span>
        {rosterName && <span className="text-xs opacity-75">{rosterName}</span>}
      </span>
      <span className="block truncate">{teamLabel(slot, now)}</span>
      {open && (
        <span className="mt-1 grid border-t border-current/20 pt-1 text-sm">
          {slot.team.map((p) => (
            <span key={`${p.lastName} ${p.firstName}`}>
              {p.firstName} {p.lastName}
            </span>
          ))}
        </span>
      )}
    </>
  )
  return (
    <li>
      {slot.team.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={className}
        >
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}
