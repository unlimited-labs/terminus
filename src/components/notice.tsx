import type { ReactNode } from "react"

export function Notice({
  tone,
  role = "alert",
  children,
}: {
  tone: "info" | "notice" | "error"
  role?: "alert" | "status"
  children: ReactNode
}) {
  return (
    <div role={role} data-tone={tone} className="stub">
      {children}
    </div>
  )
}
