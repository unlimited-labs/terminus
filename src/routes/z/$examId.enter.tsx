import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { StudentGate } from "@/components/student-gate"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { STUDENT_LOGIN as T, UNEXPECTED_ERROR } from "@/messages.pl"
import { enterWithToken } from "@/server/login-link"
import { scheduleQuery } from "@/server/schedule"
import { toast } from "sonner"

export const Route = createFileRoute("/z/$examId/enter")({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
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
  component: EnterPage,
})

/** Token zużywa dopiero kliknięcie (POST): skanery poczty otwierają linki GET i spaliłyby go. */
function EnterPage() {
  const { examId } = Route.useParams()
  const { token } = Route.useSearch()
  const { title } = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(token === undefined)
  const enter = useMutation({
    mutationFn: () => enterWithToken({ data: { examId, token: token ?? "" } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setFailed(true)
        return
      }
      await queryClient.invalidateQueries({ queryKey: scheduleQuery(examId).queryKey })
      await navigate({ to: "/z/$examId", params: { examId } })
    },
    onError: () => toast.error(UNEXPECTED_ERROR),
  })

  if (failed) {
    return <StudentGate examId={examId} name={title} unavailable={false} notice={T.linkExpired} />
  }
  return (
    <div className="mx-auto grid max-w-md gap-5 px-4 pt-10 pb-28 text-[17px]">
      <h1 className="text-2xl leading-tight font-extrabold">{title}</h1>
      <Card>
        <CardContent className="grid gap-4 pt-4">
          <h2 className="text-lg font-bold">{T.enterTitle}</h2>
          <p>{T.enterLead}</p>
          <Button size="lg" disabled={enter.isPending} onClick={() => enter.mutate()}>
            {T.enter}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
