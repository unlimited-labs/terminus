import { cn } from "cn"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/** Ramka stron studenta: `top` nad nagłówkiem, `header` pod tytułem; `narrow` dla pojedynczej karty. */
export function StudentPage({
  title,
  narrow,
  top,
  header,
  children,
}: {
  title: ReactNode
  narrow?: boolean
  top?: ReactNode
  header?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto grid gap-5 px-4 pb-28 text-[17px]",
        narrow ? "max-w-md pt-10" : "max-w-3xl pt-6",
      )}
    >
      {top}
      <header className="grid gap-1">
        <h1 className="text-2xl leading-tight font-extrabold">{title}</h1>
        {header}
      </header>
      {children}
    </div>
  )
}

/** Główna akcja strony studenta przyklejona do dołu ekranu. */
export function StickyAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
      <Button size="lg" className="mx-auto flex w-full max-w-xl" onClick={onClick}>
        {children}
      </Button>
    </div>
  )
}
