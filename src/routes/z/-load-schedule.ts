import { notFound } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { scheduleQuery } from "@/server/schedule"

/** Loader stron zapisów: dane do cache (bez ponownego pobrania), tytuł do `head`; brak = 404. */
export async function loadSchedule({
  context,
  params,
}: {
  context: { queryClient: QueryClient }
  params: { examId: string }
}) {
  if (!z.uuid().safeParse(params.examId).success) throw notFound()
  const view = await context.queryClient.query({
    ...scheduleQuery(params.examId),
    staleTime: "static",
  })
  if (!view) throw notFound()
  return { title: view.gate === "open" ? view.schedule.name : view.name }
}

export const scheduleHead = ({ loaderData }: { loaderData?: { title: string } }) => ({
  meta: [
    { title: loaderData?.title ?? "Terminus" },
    { name: "robots", content: "noindex, nofollow" },
  ],
})
