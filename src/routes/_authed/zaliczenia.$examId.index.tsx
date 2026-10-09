import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { ExamActions, ExamHeader, ExamSettingsForm } from "@/components/exam-settings"
import { RosterSection } from "@/components/roster-section"
import { SlotSection } from "@/components/slot-section"
import { TeacherSection } from "@/components/teacher-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { examQuery } from "@/server/exams"

import { loadExam } from "./-load-exam"

const tabSchema = z.enum(["sloty", "lista", "ustawienia", "prowadzacy"])

export const Route = createFileRoute("/_authed/zaliczenia/$examId/")({
  validateSearch: z.object({ tab: tabSchema.optional().catch(undefined) }),
  loader: loadExam,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Zaliczenie"} — Terminus` }],
  }),
  component: ExamPage,
})

function ExamPage() {
  const { examId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: exam } = useSuspenseQuery(examQuery(examId))
  if (!exam) return null
  const tab = search.tab ?? (exam.rosters.length ? "sloty" : "lista")
  return (
    <div className="grid gap-6">
      <ExamHeader exam={exam} />
      <Tabs
        value={tab}
        onValueChange={(next) => {
          const parsed = tabSchema.safeParse(next)
          if (parsed.success) void navigate({ search: { tab: parsed.data }, replace: true })
        }}
        className="gap-6"
      >
        <div className="flex flex-wrap items-center gap-4 border-b pb-2">
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger value="sloty">Sloty ({exam.slots.length})</TabsTrigger>
            <TabsTrigger value="lista">Lista indeksów ({exam.people.length})</TabsTrigger>
            <TabsTrigger value="ustawienia">Ustawienia</TabsTrigger>
            <TabsTrigger value="prowadzacy">Prowadzący ({exam.teachers.length})</TabsTrigger>
          </TabsList>
          <div className="ml-auto">
            <ExamActions exam={exam} />
          </div>
        </div>
        <TabsContent value="sloty">
          <SlotSection exam={exam} />
        </TabsContent>
        <TabsContent value="lista">
          <RosterSection exam={exam} />
        </TabsContent>
        <TabsContent value="ustawienia">
          <ExamSettingsForm exam={exam} />
        </TabsContent>
        <TabsContent value="prowadzacy">
          <TeacherSection exam={exam} userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
