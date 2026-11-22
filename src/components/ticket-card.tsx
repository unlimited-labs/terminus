import type { ReactNode } from "react"

/** Karta-bilet stron wejścia prowadzącego (logowanie, kod, hasło z linku). */
export function TicketCard({
  subtitle,
  children,
  footer,
}: {
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="mx-auto grid min-h-svh max-w-sm content-center gap-5 p-4">
      <div className="drop-shadow-[0_6px_14px_rgb(29_27_58/0.08)]">
        <header className="ticket-head rounded-t-xl bg-linear-160 from-[#4b3fd6] to-[#6d5bff] px-6 pt-7 pb-6 text-white">
          <h1 className="text-4xl leading-none font-extrabold tracking-tight">Terminus</h1>
          <p className="mt-2 text-lg opacity-90">{subtitle}</p>
        </header>
        <div className="ticket-stub grid gap-4 rounded-b-xl bg-card px-6 pt-7 pb-6">{children}</div>
      </div>
      {footer && <p className="px-2 text-center text-sm text-muted-foreground">{footer}</p>}
    </main>
  )
}
