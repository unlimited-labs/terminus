import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SectionCard({
  title,
  className,
  contentClassName,
  children,
}: {
  title: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-extrabold">{title}</CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
