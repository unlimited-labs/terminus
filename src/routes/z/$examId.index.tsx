import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EnrollForm, EnrollSheet, type PickedSlot } from "@/components/enroll-sheet"
import { Notice } from "@/components/notice"
import { StudentGate } from "@/components/student-gate"
import { StickyAction, StudentPage } from "@/components/student-page"
import { ScheduleBoard } from "@/components/schedule-board"
import { useExamChanges } from "@/components/use-exam-changes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isEnrollmentOpen, isFreeTeamSlot, msUntilOpen } from "@/domain/schedule"
import { formatSlotWhen, slotNumbering, type SlotNumbering } from "@/domain/time"
import { errorMessage, PICKED_SLOT_TAKEN, STUDENT_LOGIN } from "@/messages.pl"
import type { Ticket } from "@/server/enrollment.server"
import { scheduleQuery, type Schedule } from "@/server/schedule"

import { loadSchedule, scheduleHead } from "./-load-schedule"

export const Route = createFileRoute("/z/$examId/")({
  loader: loadSchedule,
  head: scheduleHead,
  component: SchedulePage,
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

function entryMode(schedule: Schedule, picked: PickedSlot | null) {
  const anyFree = schedule.slots.some((s) => isFreeTeamSlot(s, schedule.now))
  const manual = schedule.assignmentMode === "MANUAL"
  const open = isEnrollmentOpen(schedule.opensAt, schedule.now)
  return {
    anyFree,
    open,
    choosing: manual && anyFree,
    canPick: manual && open,
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

function usePickedSlot(schedule: Schedule, numbering: SlotNumbering) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [seenMode, setSeenMode] = useState(schedule.assignmentMode)
  if (schedule.assignmentMode !== seenMode) {
    setSeenMode(schedule.assignmentMode)
    setPickedId(null)
  }
  const slot = schedule.slots.find((s) => s.id === pickedId)
  const picked =
    slot && isFreeTeamSlot(slot, schedule.now)
      ? { id: slot.id, label: formatSlotWhen(slot.startsAt, numbering) }
      : null
  const taken = (slot?.team.length ?? 0) > 0
  useEffect(() => {
    if (taken) toast.info(PICKED_SLOT_TAKEN)
  }, [taken])
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
    // Klient better-auth dopiero przy wylogowaniu: reszta studentów go nie pobiera.
    const { signOutWithToast } = await import("@/lib/auth-client")
    if (!(await signOutWithToast())) return
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

function SchedulePage() {
  const { examId } = Route.useParams()
  const { data: view } = useSuspenseQuery(scheduleQuery(examId))
  // Sesja wygasła, gdy strona była już otwarta, a serwer znów żąda logowania — chyba że student
  // sam się wylogował. Ponowne logowanie idzie przez /enter, więc flaga żyje do opuszczenia strony.
  const [hadAccess, setHadAccess] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)
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
        notice={hadAccess && !loggedOut ? STUDENT_LOGIN.sessionExpired : undefined}
      />
    )
  }
  return (
    <OpenSchedule
      examId={examId}
      schedule={view.schedule}
      studentIndex={view.studentIndex}
      onLoggedOut={() => setLoggedOut(true)}
    />
  )
}

/** Harmonogram na żywo: sygnały kanału zmian oraz pobranie w chwili otwarcia zapisów wg zegara
 * serwera. Każde pobranie (nowe `now`) ustawia licznik od nowa, a kanał pobiera przy każdym
 * połączeniu, więc licznik nie zostaje na starych danych z SSR ani z pamięci podręcznej. */
function useLiveSchedule(examId: string, { opensAt, now }: Schedule) {
  const queryClient = useQueryClient()
  useExamChanges(examId, scheduleQuery(examId).queryKey)
  useEffect(() => {
    const { queryKey } = scheduleQuery(examId)
    const ms = msUntilOpen(opensAt, now)
    if (ms === null) return
    const timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey }), ms)
    return () => clearTimeout(timer)
  }, [queryClient, examId, opensAt, now])
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
  const numbering = slotNumbering(schedule)
  const [picked, setPickedId] = usePickedSlot(schedule, numbering)
  const [showCount, setShowCount] = useState(0)
  useLiveSchedule(examId, schedule)

  const mode = entryMode(schedule, picked)
  const title = mine ? "Twój slot" : mode.action

  return (
    <StudentPage
      title={schedule.name}
      top={
        studentIndex && (
          <StudentBar examId={examId} index={studentIndex} onLoggedOut={onLoggedOut} />
        )
      }
      header={
        <>
          {schedule.description && (
            <p className="whitespace-pre-line text-muted-foreground">{schedule.description}</p>
          )}
          <p className="text-muted-foreground">Prowadzący: {schedule.teacherNames}</p>
        </>
      }
    >
      {!mine && <EntryNotice opensAt={schedule.opensAt} open={mode.open} anyFree={mode.anyFree} />}
      <ScheduleBoard
        key={showCount}
        schedule={schedule}
        mySlotId={mine?.slotId ?? null}
        pulse={showCount > 0}
        pickedSlotId={picked?.id ?? null}
        onPick={
          mode.canPick && !mine
            ? (slot) => {
                setPickedId(slot.id)
                setOpen(true)
              }
            : undefined
        }
      />
      {mode.open && <StickyAction onClick={() => setOpen(true)}>{title}</StickyAction>}
      <EnrollSheet
        place={schedule.description}
        numbering={numbering}
        title={title}
        open={open}
        onOpenChange={setOpen}
        ticket={mine?.ticket ?? null}
        onShowOnBoard={() => {
          setOpen(false)
          setShowCount(showCount + 1)
        }}
      >
        <EnrollForm
          examId={examId}
          assignmentMode={schedule.assignmentMode}
          emailLogin={schedule.requireEmailLogin}
          choosing={mode.choosing}
          picked={picked}
          maxTeamSize={mode.maxTeamSize}
          fields={mode.fields}
          submitLabel={mode.submitLabel}
          slotWhen={(at) => formatSlotWhen(at, numbering)}
          onEnrolled={(slotId, ticket) => {
            // Własny zapis zajmuje slot — bez toastu „zajął ktoś inny”.
            // shortcut: odświeżenie z kanału przed odpowiedzią zapisu nadal pokaże toast; blokować na czas zapisu, jeśli ktoś to zgłosi
            setPickedId(null)
            setMine({ slotId, ticket })
          }}
        />
      </EnrollSheet>
    </StudentPage>
  )
}
