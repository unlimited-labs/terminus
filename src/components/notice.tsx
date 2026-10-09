import type { ReactNode } from "react"

import { Alert } from "@/components/ui/alert"

const TONE = {
  info: "border-free bg-free/10",
  notice: "border-primary bg-primary/10",
  error: "border-destructive bg-destructive/10",
}

export function Notice({
  tone,
  role = "alert",
  children,
}: {
  tone: keyof typeof TONE
  role?: "alert" | "status"
  children: ReactNode
}) {
  return (
    <Alert role={role} className={`border-0 border-l-4 px-3 py-2 text-[1em] ${TONE[tone]}`}>
      {children}
    </Alert>
  )
}
