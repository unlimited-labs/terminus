import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { EnrollSheet } from "@/components/enroll-sheet"
import { ScheduleBoard } from "@/components/schedule-board"
import { Button } from "@/components/ui/button"
import { isEnrollmentOpen, isFreeSlot } from "@/domain/schedule"
import { errorMessage } from "@/messages.pl"
import type { Ticket } from "@/server/enrollment.server"
import { scheduleQuery, type Schedule } from "@/server/schedule"

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
      { title: loaderData?.title ?? "Terminus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StudentPage,
})

function EntryNotice({ schedule, anyFree }: { schedule: Schedule; anyFree: boolean }) {
  if (schedule.opensAt && !isEnrollmentOpen(schedule.opensAt, schedule.now)) {
    return (
      <p role="status" className="rounded-lg border-l-4 border-primary bg-primary/10 px-3 py-2">
        {errorMessage({ code: "NOT_OPEN_YET", opensAt: schedule.opensAt })} Strona odświeży się
        sama.
      </p>
    )
  }
  if (anyFree) return null
  return (
    <p
      role="status"
      className="rounded-lg border-l-4 border-destructive bg-destructive/10 px-3 py-2"
    >
      {errorMessage({ code: "NO_FREE_SLOTS" })}
    </p>
  )
}

/** Co oferuje panel: zapis z losowaniem, a przy braku wolnych slotów tylko sprawdzenie swojego. */
function entryMode(schedule: Schedule, enrolled: boolean) {
  const anyFree = schedule.slots.some((s) => isFreeSlot(s, s.team.length > 0, schedule.now))
  return {
    anyFree,
    open: isEnrollmentOpen(schedule.opensAt, schedule.now),
    action: enrolled ? "Twój slot" : anyFree ? "Zapisz się" : "Sprawdź swój slot",
    submitLabel: anyFree ? "Losuj slot" : "Sprawdź",
    maxTeamSize: anyFree ? schedule.maxTeamSize : 1,
    fields: anyFree ? schedule.fields : [],
  }
}

function StudentPage() {
  const { examId } = Route.useParams()
  const { data: schedule } = useSuspenseQuery(scheduleQuery(examId))
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState<{ slotId: string; ticket: Ticket } | null>(null)
  const [showCount, setShowCount] = useState(0)
  if (!schedule) {
    return (
      <p role="status" className="mx-auto max-w-3xl px-4 pt-6">
        Tego zaliczenia już nie ma — prowadzący je usunął.
      </p>
    )
  }

  const mode = entryMode(schedule, mine !== null)

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 pt-6 pb-28 text-[17px]">
      <header className="grid gap-1">
        <h1 className="text-2xl leading-tight font-extrabold">{schedule.name}</h1>
        {schedule.description && (
          <p className="whitespace-pre-line text-muted-foreground">{schedule.description}</p>
        )}
        <p className="text-muted-foreground">Prowadzący: {schedule.ownerName}</p>
      </header>
      {!mine && <EntryNotice schedule={schedule} anyFree={mode.anyFree} />}
      <ScheduleBoard
        key={showCount}
        schedule={schedule}
        mySlotId={mine?.slotId ?? null}
        pulse={showCount > 0}
      />
      {mode.open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
          <Button size="lg" className="mx-auto flex w-full max-w-xl" onClick={() => setOpen(true)}>
            {mode.action}
          </Button>
        </div>
      )}
      <EnrollSheet
        examId={examId}
        place={schedule.description}
        title={mode.action}
        submitLabel={mode.submitLabel}
        maxTeamSize={mode.maxTeamSize}
        fields={mode.fields}
        open={open}
        onOpenChange={setOpen}
        ticket={mine?.ticket ?? null}
        onEnrolled={(slotId, ticket) => setMine({ slotId, ticket })}
        onShowOnBoard={() => {
          setOpen(false)
          setShowCount(showCount + 1)
        }}
      />
    </div>
  )
}
