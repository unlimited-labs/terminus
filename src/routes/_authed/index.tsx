import { Meter } from "@base-ui/react/meter"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { ExamForm } from "@/components/exam-form"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { useResultMutation } from "@/components/use-result-mutation"
import type { ExamPhase } from "@/domain/schedule"
import { formatDateRange, formatWarsaw } from "@/domain/time"
import { PHASE_LABEL, phaseStatus } from "@/messages.pl"
import type { examsOf } from "@/server/exam-ops.server"
import { createExam, examsQuery } from "@/server/exams"

export const Route = createFileRoute("/_authed/")({
  loader: ({ context }) => context.queryClient.query({ ...examsQuery(), staleTime: "static" }),
  head: () => ({ meta: [{ title: "Moje zaliczenia — Terminus" }] }),
  component: ExamList,
})

type Exam = Awaited<ReturnType<typeof examsOf>>[number]

const SECTIONS: ExamPhase[] = ["open", "scheduled", "draft", "done"]

function ExamList() {
  const { data: exams } = useSuspenseQuery(examsQuery())
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const create = useResultMutation(createExam, [examsQuery().queryKey], ({ examId }) =>
    navigate({ to: "/zaliczenia/$examId", params: { examId } }),
  )

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="flex items-end gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Moje zaliczenia</h1>
        {!creating && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            Nowe zaliczenie
          </Button>
        )}
      </div>
      {creating && (
        <SectionCard title="Nowe zaliczenie">
          <ExamForm
            defaultValues={{
              name: "",
              description: "",
              defaultSlotMinutes: 15,
              maxTeamSize: 1,
              assignmentMode: "RANDOM",
              fields: [],
              opensDate: "",
              opensTime: "",
            }}
            submitLabel="Utwórz"
            onSubmit={create.mutateAsync}
          />
        </SectionCard>
      )}
      {exams.length === 0 && !creating && (
        <p className="text-muted-foreground">
          Nie masz jeszcze żadnego zaliczenia. Utwórz pierwsze, a potem dodaj listę indeksów i
          sloty.
        </p>
      )}
      {SECTIONS.map((phase) => {
        const items = exams.filter((e) => e.phase === phase)
        if (!items.length) return null
        const heading = (
          <>
            {PHASE_LABEL[phase]} <span className="text-muted-foreground">({items.length})</span>
          </>
        )
        const list = (
          <ul className="divide-y rounded-2xl border bg-card">
            {items.map((exam) => (
              <ExamRow key={exam.id} exam={exam} />
            ))}
          </ul>
        )
        return phase === "done" ? (
          <details key={phase}>
            <summary className="cursor-pointer text-lg font-bold">{heading}</summary>
            <div className="mt-3">{list}</div>
          </details>
        ) : (
          <section key={phase} className="grid gap-3">
            <h2 className="text-lg font-bold">{heading}</h2>
            {list}
          </section>
        )
      })}
    </div>
  )
}

function ExamRow({ exam }: { exam: Exam }) {
  const details = [status(exam), dateRange(exam), coTeachers(exam)].filter(Boolean).join(", ")
  return (
    <li>
      <Link
        to="/zaliczenia/$examId"
        params={{ examId: exam.id }}
        className="grid grid-cols-[3.5rem_1fr] items-center gap-4 px-4 py-3 outline-none first:rounded-t-2xl last:rounded-b-2xl hover:bg-secondary/50 focus-visible:bg-secondary sm:grid-cols-[3.5rem_1fr_11rem]"
      >
        <DateLeaf date={exam.firstSlotStart} />
        <div className="min-w-0">
          <p className="truncate font-bold">{exam.name}</p>
          <p className="truncate text-sm text-muted-foreground">{details}</p>
        </div>
        {exam.phase !== "draft" && (
          <div className="col-span-2 grid gap-1 sm:col-span-1">
            <p className="text-sm tabular-nums">
              <strong>{exam.enrolled}</strong>{" "}
              <span className="text-muted-foreground">z {exam.entries} zapisanych</span>
            </p>
            <Meter.Root aria-label="Zapisani" value={exam.enrolled} max={exam.entries}>
              <Meter.Track className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <Meter.Indicator className="h-full rounded-full bg-free" />
              </Meter.Track>
            </Meter.Root>
          </div>
        )}
      </Link>
    </li>
  )
}

function DateLeaf({ date }: { date: Date | null }) {
  if (!date) return <div className="h-14 rounded-xl border border-dashed" />
  return (
    <div className="grid h-14 place-items-center rounded-xl bg-secondary text-center leading-none">
      <span>
        <span className="block text-xl font-extrabold tabular-nums">{formatWarsaw(date, "d")}</span>
        <span className="text-xs text-muted-foreground">{formatWarsaw(date, "LLL")}</span>
      </span>
    </div>
  )
}

function status(exam: Exam) {
  if (exam.phase === "draft") {
    if (!exam.firstSlotStart && !exam.entries) return "Brak list i slotów"
    return exam.firstSlotStart ? "Brak listy indeksów" : "Brak slotów"
  }
  return exam.phase === "open" ? null : phaseStatus(exam.phase, exam.opensAt)
}

function dateRange({ firstSlotStart: first, lastSlotEnd: last }: Exam) {
  return first && last ? formatDateRange(first, last, new Date()) : null
}

function coTeachers(exam: Exam) {
  return exam.coTeachers.length ? `razem z: ${exam.coTeachers.join(", ")}` : null
}
