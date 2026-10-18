import type { ReactNode } from "react"

/** Tytuł strony panelu prowadzącego. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-extrabold tracking-tight">{children}</h1>
}
