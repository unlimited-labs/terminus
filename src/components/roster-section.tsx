import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import { ConfirmButton } from "@/components/confirm-button"
import { schemaSubmit, useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/section-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { currentRosterId, hasManyRosters, rosterNames } from "@/components/roster-choice"
import { toastUnexpected, useExamMutation } from "@/components/use-result-mutation"
import { suggestRosterName } from "@/domain/csv"
import { formatDayTime } from "@/domain/time"
import { errorMessage, GRADE, GRADING, INVALID_ROW, UNEXPECTED_ERROR } from "@/messages.pl"
import { addEntrySchema, entryEmail, rosterImportSchema } from "@/schemas/roster"
import type { ExamDetail } from "@/server/exam-state.server"
import {
  addRosterEntry,
  applyRosterImport,
  deleteRoster,
  changeEntryEmail,
  deleteRosterEntry,
  entryEmailsQuery,
  previewRosterImport,
} from "@/server/rosters"

export function RosterSection({ exam }: { exam: ExamDetail }) {
  const multi = hasManyRosters(exam.rosters)
  const rosterName = rosterNames(exam.rosters)
  const removeEntry = useExamMutation(deleteRosterEntry, exam.id)
  const removeRoster = useExamMutation(deleteRoster, exam.id)
  const emails = useQuery(entryEmailsQuery(exam.id)).data

  return (
    <SectionCard
      title={
        <>
          {multi ? "Listy indeksów" : "Lista indeksów"}{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({exam.people.length})
          </span>
        </>
      }
      contentClassName="grid gap-6"
    >
      <RosterImport exam={exam} />
      <AddEntryForm exam={exam} />
      {multi && (
        <ul className="flex flex-wrap gap-2">
          {exam.rosters.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-sm"
            >
              {r.name}
              <ConfirmButton
                title={`Usunąć listę ${r.name}?`}
                description="Znikną jej osoby i sloty. Jeśli ktoś z tej listy ma zapis, lista zostanie — najpierw przenieś albo usuń zapisy."
                confirmLabel="Usuń listę"
                onConfirm={() => removeRoster.mutateAsync({ examId: exam.id, rosterId: r.id })}
              >
                Usuń listę
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      {exam.people.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indeks</TableHead>
              <TableHead>Nazwisko i imię</TableHead>
              <TableHead>Adres e-mail</TableHead>
              {multi && <TableHead>Lista</TableHead>}
              <TableHead>Zapis</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {exam.people.map((p) => (
              <TableRow key={p.studentNumber}>
                <TableCell className="tabular-nums">{p.studentNumber}</TableCell>
                <TableCell>
                  {p.lastName} {p.firstName}
                </TableCell>
                <TableCell>
                  {emails?.[p.studentNumber] !== undefined && (
                    <EmailCell
                      examId={exam.id}
                      studentNumber={p.studentNumber}
                      email={emails[p.studentNumber]!}
                    />
                  )}
                </TableCell>
                {multi && <TableCell>{rosterName.get(p.rosterId)}</TableCell>}
                <TableCell>{p.slotId ? <Badge>zapisany</Badge> : null}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={p.slotId !== null}
                    title={p.slotId ? "Najpierw przenieś albo usuń zapis" : undefined}
                    onClick={() =>
                      removeEntry.mutate({ examId: exam.id, studentNumber: p.studentNumber })
                    }
                  >
                    Usuń
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

function AddEntryForm({ exam }: { exam: ExamDetail }) {
  const add = useExamMutation(addRosterEntry, exam.id, () =>
    toast.success("Dodano osobę do listy."),
  )
  const form = useAppForm({
    defaultValues: {
      examId: exam.id,
      rosterId: exam.rosters[0]?.id ?? "",
      studentNumber: "",
      firstName: "",
      lastName: "",
      email: "",
    },
    ...schemaSubmit(addEntrySchema, add.mutateAsync, {
      prepare: (v) => ({ ...v, rosterId: currentRosterId(exam.rosters, v.rosterId) }),
      resetOnOk: true,
    }),
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        <form.AppField name="studentNumber">{(f) => <f.TextField label="Indeks" />}</form.AppField>
        <form.AppField name="firstName">{(f) => <f.TextField label="Imię" />}</form.AppField>
        <form.AppField name="lastName">{(f) => <f.TextField label="Nazwisko" />}</form.AppField>
        <form.AppField name="email">
          {(f) => <f.TextField label="Adres e-mail (opcjonalnie)" type="email" />}
        </form.AppField>
        <form.AppField name="rosterId">
          {(f) => <f.RosterField rosters={exam.rosters} />}
        </form.AppField>
        <div className="self-end">
          <form.SubmitButton>Dodaj osobę</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  )
}

type ImportInput = z.input<typeof rosterImportSchema>

function RosterImport({ exam }: { exam: ExamDetail }) {
  const [input, setInput] = useState<ImportInput | null>(null)
  const preview = useMutation({
    mutationFn: (data: ImportInput) => previewRosterImport({ data }),
    onError: toastUnexpected,
  })
  const previewChecked = (data: ImportInput) => {
    const parsed = rosterImportSchema.safeParse(data)
    if (parsed.success) preview.mutate(data)
    else toast.error(parsed.error.issues[0]?.message ?? UNEXPECTED_ERROR)
  }
  const apply = useExamMutation(applyRosterImport, exam.id, () => {
    setInput(null)
    preview.reset()
    toast.success("Zaimportowano listę.")
  })

  const load = async (file: File) => {
    const next = {
      examId: exam.id,
      rosterName: suggestRosterName(file.name),
      csv: await file.text(),
    }
    setInput(next)
    previewChecked(next)
  }
  const previewedName = preview.variables?.rosterName
  const refresh = () => {
    if (input?.rosterName.trim() && input.rosterName !== previewedName) previewChecked(input)
  }
  const result = preview.data

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="roster-csv">Import listy z pliku CSV (eksport z systemu uczelni)</Label>
        <Input
          id="roster-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void load(file)
            e.target.value = ""
          }}
        />
      </div>
      {input && result && !result.ok && (
        <p className="text-sm text-destructive">{errorMessage(result)}</p>
      )}
      {input && result?.ok && (
        <div className="grid gap-3 rounded-xl border p-4 text-sm">
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="roster-name">Nazwa listy</Label>
            <Input
              id="roster-name"
              value={input.rosterName}
              onChange={(e) => setInput({ ...input, rosterName: e.target.value })}
              onBlur={refresh}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
            />
          </div>
          <p>
            {result.rosterId ? "Ponowny import do istniejącej listy." : "Nowa lista."} Osoby w
            pliku: {result.people} (nowe {result.add.length}, zmienione nazwiska{" "}
            {result.update.length}, bez zmian {result.unchanged}). W pliku skreśleni lub z
            rezygnacją: {result.withdrawn}.
            {result.badEmails > 0 &&
              ` Zastąpionych niepoprawnych adresów e-mail: ${result.badEmails}.`}
          </p>
          <PreviewList title="Błędne — nie zostaną zaimportowane">
            {[
              ...result.invalid.map(
                (r) =>
                  `wiersz ${r.line}: ${r.studentNumber || "(pusty)"} — ${INVALID_ROW[r.reason]}`,
              ),
              ...result.otherRoster.map(
                (r) => `wiersz ${r.line}: ${r.studentNumber} — ${INVALID_ROW.OTHER_ROSTER}`,
              ),
            ]}
          </PreviewList>
          <PreviewList title="Znikną z listy (skreśleni, bez zapisu)">
            {result.remove.filter((e) => !e.slotStartsAt).map(entryLine)}
          </PreviewList>
          <PreviewList title="Skreśleni z zapisem — znikną z listy, a ich zapis zostanie usunięty">
            {result.withdrawnEnrolled.map(
              (e) =>
                `${entryLine(e)} — slot ${formatDayTime(e.slotStartsAt)}${e.grade ? GRADING.previewGrade(GRADE[e.grade].name) : ""}`,
            )}
          </PreviewList>
          <PreviewList title="Na liście, ale nie ma ich w pliku — zostają">
            {result.notInFile.map(entryLine)}
          </PreviewList>
          <div className="flex gap-2">
            <Button
              disabled={apply.isPending || preview.isPending || input.rosterName !== previewedName}
              onClick={async () => {
                const done = await apply.mutateAsync({
                  ...input,
                  withdrawnEnrolled: result.withdrawnEnrolled.map((e) => e.studentNumber),
                })
                if (!done.ok && done.code === "IMPORT_PREVIEW_STALE") preview.mutate(input)
              }}
            >
              Zapisz listę
            </Button>
            <Button variant="outline" onClick={() => setInput(null)}>
              Anuluj
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Adres zapisuje się po opuszczeniu pola; pusty wraca do domyślnego. */
function EmailCell({
  examId,
  studentNumber,
  email,
}: {
  examId: string
  studentNumber: string
  email: string
}) {
  const change = useExamMutation(changeEntryEmail, examId)
  return (
    <Input
      key={email}
      type="email"
      aria-label={`Adres e-mail, indeks ${studentNumber}`}
      defaultValue={email}
      className="h-8 min-w-56"
      onBlur={(e) => {
        const next = e.target.value.trim().toLowerCase()
        if (next === email) return
        if (!entryEmail.safeParse(next).success) {
          toast.error("Podaj poprawny adres e-mail.")
          e.target.value = email
          return
        }
        change.mutate({ examId, studentNumber, email: next })
      }}
    />
  )
}

function PreviewList({ title, children }: { title: string; children: string[] }) {
  if (children.length === 0) return null
  return (
    <div>
      <p className="font-semibold">
        {title} ({children.length})
      </p>
      <ul className="list-inside list-disc text-muted-foreground">
        {children.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

const entryLine = (e: { studentNumber: string; lastName: string; firstName: string }) =>
  `${e.studentNumber} ${e.lastName} ${e.firstName}`
