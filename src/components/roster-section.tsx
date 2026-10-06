import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { currentRosterId } from "@/components/roster-choice"
import { useResultMutation } from "@/components/use-result-mutation"
import { suggestRosterName } from "@/domain/csv"
import { formatDayTime } from "@/domain/time"
import { errorMessage, INVALID_ROW } from "@/messages.pl"
import { addEntrySchema } from "@/schemas/roster"
import type { ExamDetail } from "@/server/exam-state.server"
import {
  addRosterEntry,
  applyRosterImport,
  deleteRoster,
  deleteRosterEntry,
  previewRosterImport,
} from "@/server/rosters"
import { examChangeKeys } from "@/server/exams"

export function RosterSection({ exam }: { exam: ExamDetail }) {
  const multi = exam.rosters.length > 1
  const rosterName = new Map(exam.rosters.map((r) => [r.id, r.name]))
  const removeEntry = useResultMutation(deleteRosterEntry, examChangeKeys(exam.id))
  const removeRoster = useResultMutation(deleteRoster, examChangeKeys(exam.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-extrabold">
          {multi ? "Listy indeksów" : "Lista indeksów"}{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({exam.people.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
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
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => removeRoster.mutate({ examId: exam.id, rosterId: r.id })}
                >
                  Usuń listę
                </Button>
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
      </CardContent>
    </Card>
  )
}

function AddEntryForm({ exam }: { exam: ExamDetail }) {
  const add = useResultMutation(addRosterEntry, examChangeKeys(exam.id), () =>
    toast.success("Dodano osobę do listy."),
  )
  const form = useAppForm({
    defaultValues: {
      examId: exam.id,
      rosterId: exam.rosters[0]?.id ?? "",
      studentNumber: "",
      firstName: "",
      lastName: "",
    },
    validators: { onSubmit: addEntrySchema },
    onSubmit: async ({ value, formApi }) => {
      const rosterId = currentRosterId(exam.rosters, value.rosterId)
      if ((await add.mutateAsync(addEntrySchema.parse({ ...value, rosterId }))).ok) formApi.reset()
    },
  })
  return (
    <form.AppForm>
      <form.Form className="grid items-start gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        <form.AppField name="studentNumber">{(f) => <f.TextField label="Indeks" />}</form.AppField>
        <form.AppField name="firstName">{(f) => <f.TextField label="Imię" />}</form.AppField>
        <form.AppField name="lastName">{(f) => <f.TextField label="Nazwisko" />}</form.AppField>
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

type ImportInput = { examId: string; rosterName: string; csv: string }

function RosterImport({ exam }: { exam: ExamDetail }) {
  const [input, setInput] = useState<ImportInput | null>(null)
  const preview = useMutation({ mutationFn: (data: ImportInput) => previewRosterImport({ data }) })
  const apply = useResultMutation(applyRosterImport, examChangeKeys(exam.id), () => {
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
    preview.mutate(next)
  }
  const rename = (rosterName: string) => {
    if (!input) return
    const next = { ...input, rosterName }
    setInput(next)
    if (rosterName.trim()) preview.mutate(next)
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
              onChange={(e) => rename(e.target.value)}
            />
          </div>
          <p>
            {result.rosterId ? "Ponowny import do istniejącej listy." : "Nowa lista."} Osoby w
            pliku: {result.people} (nowe {result.add.length}, zmienione nazwiska{" "}
            {result.update.length}, bez zmian {result.unchanged}). W pliku skreśleni lub z
            rezygnacją: {result.withdrawn}.
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
            {result.remove
              .filter((e) => !e.slotStartsAt)
              .map((e) => `${e.studentNumber} ${e.lastName} ${e.firstName}`)}
          </PreviewList>
          <PreviewList title="Skreśleni z zapisem — znikną z listy, a ich zapis zostanie usunięty">
            {result.withdrawnEnrolled.map(
              (e) =>
                `${e.studentNumber} ${e.lastName} ${e.firstName} — slot ${formatDayTime(e.slotStartsAt)}`,
            )}
          </PreviewList>
          <PreviewList title="Na liście, ale nie ma ich w pliku — zostają">
            {result.notInFile.map((e) => `${e.studentNumber} ${e.lastName} ${e.firstName}`)}
          </PreviewList>
          <div className="flex gap-2">
            <Button
              disabled={apply.isPending || preview.isPending}
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
