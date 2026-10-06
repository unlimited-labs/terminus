import { notFound } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

import { examQuery } from "@/server/exams"

/** Loader stron zaliczenia: dane do cache (bez ponownego pobrania), tytuł do `head`; cudze = 404. */
export async function loadExam({
  context,
  params,
}: {
  context: { queryClient: QueryClient }
  params: { examId: string }
}) {
  const exam = await context.queryClient.query({ ...examQuery(params.examId), staleTime: "static" })
  if (!exam) throw notFound()
  return { title: exam.name }
}
