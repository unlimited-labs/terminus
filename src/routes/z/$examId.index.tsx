import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { EnrollSheet, type PickedSlot } from "@/components/enroll-sheet"
import { Notice } from "@/components/notice"
import { StudentGate } from "@/components/student-gate"
import { ScheduleBoard } from "@/components/schedule-board"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isEnrollmentOpen, isFreeSlot } from "@/domain/schedule"
import { formatDayTime } from "@/domain/time"
import { authClient, authFailure } from "@/lib/auth-client"
import { errorMessage, STUDENT_LOGIN } from "@/messages.pl"
import type { Ticket } from "@/server/enrollment.server"
import { scheduleQuery, type Schedule } from "@/server/schedule"

export const Route = createFileRoute("/z/$examId/")({
  loader: async ({ context, params }) => {
    if (!z.uuid().safeParse(params.examId).success) throw notFound()
    const view = await context.queryClient.query({
      ...scheduleQuery(params.examId),
      staleTime: "static",
    })
    if (!view) throw notFound()
    return { title: view.gate === "open" ? view.schedule.name : view.name }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ?? "Terminus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StudentPage,
})

function EntryNotice({
  opensAt,
  open,
  anyFree,
}: {
  opensAt: Date | null
  open: boolean
  anyFree: boolean
}) {
  if (opensAt && !open) {
    return (
      <Notice tone="notice" role="status">
        {errorMessage({ code: "NOT_OPEN_YET", opensAt })} Strona odświeży się sama.
      </Notice>
    )
  }
  if (anyFree) return null
  return (
    <Notice tone="error" role="status">
      {errorMessage({ code: "NO_FREE_SLOTS" })}
    </Notice>
  )
}

const isFree = (schedule: Schedule, s: Schedule["slots"][number]) =>
  isFreeSlot(s, s.team.length > 0, schedule.now)

function entryMode(schedule: Schedule, picked: PickedSlot | null) {
  const anyFree = schedule.slots.some((s) => isFree(schedule, s))
  const manual = schedule.assignmentMode === "MANUAL"
  return {
    anyFree,
    open: isEnrollmentOpen(schedule.opensAt, schedule.now),
    choosing: manual && anyFree,
    action: anyFree ? "Zapisz się" : "Sprawdź swój slot",
    submitLabel: !anyFree
      ? "Sprawdź"
      : manual
        ? picked
          ? `Zapisz się na ${picked.label}`
          : "Wybierz slot"
        : "Losuj slot",
    maxTeamSize: anyFree ? schedule.maxTeamSize : 1,
    fields: anyFree ? schedule.fields : [],
  }
}

function usePickedSlot(schedule: Schedule | null | undefined) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [seenMode, setSeenMode] = useState(schedule?.assignmentMode)
  if (schedule && schedule.assignmentMode !== seenMode) {
    setSeenMode(schedule.assignmentMode)
    setPickedId(null)
  }
  const slot = schedule?.slots.find((s) => s.id === pickedId && isFree(schedule, s))
  const picked = slot ? { id: slot.id, label: formatDayTime(slot.startsAt) } : null
  return [picked, setPickedId] as const
}

/** Pasek zalogowanego studenta (opcja logowania mailem): plakietka indeksu i wylogowanie. */
function StudentBar({
  examId,
  index,
  onLoggedOut,
}: {
  examId: string
  index: string
  onLoggedOut: () => void
}) {
  const queryClient = useQueryClient()
  const logout = async () => {
    const failure = await authFailure(authClient.signOut())
    if (failure) {
      toast.error(failure)
      return
    }
    onLoggedOut()
    await queryClient.invalidateQueries({ queryKey: scheduleQuery(examId).queryKey })
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <Badge variant="secondary">{index}</Badge>
      <Button variant="ghost" size="sm" onClick={logout}>
        {STUDENT_LOGIN.logout}
      </Button>
    </div>
  )
}

function StudentPage() {
  const { examId } = Route.useParams()
  const { data: view } = useSuspenseQuery(scheduleQuery(examId))
  // Sesja wygasła, gdy strona była już otwarta, a serwer znów żąda logowania.
  const [hadAccess, setHadAccess] = useState(false)
  if (view?.gate === "open" && !hadAccess) setHadAccess(true)
  if (!view) {
    return (
      <p role="status" className="mx-auto max-w-3xl px-4 pt-6">
        Tego zaliczenia już nie ma — prowadzący je usunął.
      </p>
    )
  }
  if (view.gate !== "open") {
    return (
      <StudentGate
        examId={examId}
        name={view.name}
        unavailable={view.gate === "unavailable"}
        notice={hadAccess ? STUDENT_LOGIN.sessionExpired : undefined}
      />
    )
  }
  return (
    <OpenSchedule
      examId={examId}
      schedule={view.schedule}
      studentIndex={view.studentIndex}
      onLoggedOut={() => setHadAccess(false)}
    />
  )
}

function OpenSchedule({
  examId,
  schedule,
  studentIndex,
  onLoggedOut,
}: {
  examId: string
  schedule: Schedule
  studentIndex: string | null
  onLoggedOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState<{ slotId: string; ticket: Ticket } | null>(null)
  const [picked, setPickedId] = usePickedSlot(schedule)
  const [showCount, setShowCount] = useState(0)

  const mode = entryMode(schedule, picked)
  const title = mine ? "Twój slot" : mode.action

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 pt-6 pb-28 text-[17px]">
      {studentIndex && (
        <StudentBar examId={examId} index={studentIndex} onLoggedOut={onLoggedOut} />
      )}
      <header className="grid gap-1">
        <h1 className="text-2xl leading-tight font-extrabold">{schedule.name}</h1>
        {schedule.description && (
          <p className="whitespace-pre-line text-muted-foreground">{schedule.description}</p>
        )}
        <p className="text-muted-foreground">Prowadzący: {schedule.teacherNames}</p>
      </header>
      {!mine && <EntryNotice opensAt={schedule.opensAt} open={mode.open} anyFree={mode.anyFree} />}
      <ScheduleBoard
        key={showCount}
        schedule={schedule}
        mySlotId={mine?.slotId ?? null}
        pulse={showCount > 0}
        pickedSlotId={picked?.id ?? null}
        onPick={
          schedule.assignmentMode === "MANUAL" && mode.open && !mine
            ? (slot) => {
                setPickedId(slot.id)
                setOpen(true)
              }
            : undefined
        }
      />
      {mode.open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
          <Button size="lg" className="mx-auto flex w-full max-w-xl" onClick={() => setOpen(true)}>
            {title}
          </Button>
        </div>
      )}
      <EnrollSheet
        examId={examId}
        place={schedule.description}
        title={title}
        submitLabel={mode.submitLabel}
        assignmentMode={schedule.assignmentMode}
        emailLogin={schedule.requireEmailLogin}
        choosing={mode.choosing}
        picked={picked}
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
