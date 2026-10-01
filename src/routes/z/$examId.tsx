import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { EnrollSheet } from "@/components/enroll-sheet"
import { ScheduleBoard } from "@/components/schedule-board"
import { Button } from "@/components/ui/button"
import { isFreeSlot } from "@/domain/schedule"
import type { Ticket } from "@/server/enrollment.server"
import { scheduleQuery } from "@/server/schedule"

export const Route = createFileRoute("/z/$examId")({
  loader: async ({ context, params }) => {
    if (!z.uuid().safeParse(params.examId).success) throw notFound()
    const schedule = await context.queryClient.query({
      ...scheduleQuery(params.examId),
      staleTime: "static",
    })
    if (!schedule) throw notFound()
    return { title: schedule.name }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ?? "Zapisy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StudentPage,
})

function StudentPage() {
  const { examId } = Route.useParams()
  const { data: schedule } = useSuspenseQuery(scheduleQuery(examId))
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState<{ slotId: string; ticket: Ticket } | null>(null)
  const [pulse, setPulse] = useState(false)
  if (!schedule) return null

  const anyFree = schedule.slots.some((s) => isFreeSlot(s, schedule.now))
  const action = mine ? "Twój slot" : anyFree ? "Zapisz się" : "Sprawdź swój slot"

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 pt-6 pb-28 text-[17px]">
      <header className="grid gap-1">
        <h1 className="text-2xl leading-tight font-extrabold">{schedule.name}</h1>
        {schedule.description && (
          <p className="whitespace-pre-line text-muted-foreground">{schedule.description}</p>
        )}
        <p className="text-muted-foreground">Prowadzący: {schedule.ownerName}</p>
      </header>
      {!anyFree && !mine && (
        <p
          role="status"
          className="rounded-lg border-l-4 border-destructive bg-destructive/10 px-3 py-2"
        >
          Brak wolnych slotów. Skontaktuj się z prowadzącym.
        </p>
      )}
      <ScheduleBoard schedule={schedule} mySlotId={mine?.slotId ?? null} pulse={pulse} />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
        <Button size="lg" className="mx-auto flex w-full max-w-xl" onClick={() => setOpen(true)}>
          {action}
        </Button>
      </div>
      <EnrollSheet
        examId={examId}
        place={schedule.description}
        title={action}
        submitLabel={anyFree ? "Losuj slot" : "Sprawdź"}
        maxTeamSize={anyFree ? schedule.maxTeamSize : 1}
        open={open}
        onOpenChange={setOpen}
        ticket={mine?.ticket ?? null}
        onEnrolled={(slotId, ticket) => setMine({ slotId, ticket })}
        onShowOnBoard={() => {
          setOpen(false)
          setPulse(true)
        }}
      />
    </div>
  )
}
