import { formatDayTime, warsawTime } from "@/domain/time"
import type { Ticket as TicketData } from "@/server/enrollment.server"

export function Ticket({ ticket, place }: { ticket: TicketData; place: string }) {
  const [day] = formatDayTime(ticket.startsAt).split(",")
  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-160 from-[#4b3fd6] to-[#6d5bff] p-5 text-white">
      <p className="font-semibold opacity-90 first-letter:uppercase">{day}</p>
      <p className="my-1 text-5xl leading-none font-extrabold tracking-tight tabular-nums">
        {warsawTime(ticket.startsAt)}
        <span className="text-2xl opacity-80">–{warsawTime(ticket.endsAt)}</span>
      </p>
      {place && <p className="whitespace-pre-line opacity-90">{place}</p>}
      {ticket.answers.length > 0 && (
        <dl className="mt-3 grid gap-1 text-sm">
          {ticket.answers.map((a) => (
            <div key={a.label}>
              <dt className="inline opacity-80">{a.label}: </dt>
              <dd className="inline font-semibold">{a.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="ticket-cut mt-4 grid gap-1 border-t-2 border-dashed border-white/45 pt-3">
        {ticket.team.map((p) => (
          <li key={p.studentNumber} className="flex justify-between gap-4">
            <span>
              {p.firstName} {p.lastName}
            </span>
            <span className="tabular-nums opacity-80">{p.studentNumber}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm opacity-90">
        Slot jest przydzielony na stałe. Zmianę uzgodnij z prowadzącym.
      </p>
    </div>
  )
}
