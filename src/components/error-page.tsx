import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export function ErrorPage() {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()
  useEffect(() => queryErrorResetBoundary.reset(), [queryErrorResetBoundary])

  return (
    <main className="mx-auto max-w-xl p-6 pt-16">
      <h1 className="text-2xl font-extrabold">Coś poszło nie tak</h1>
      <p className="mt-2 text-muted-foreground">
        Nie udało się wczytać strony. Spróbuj ponownie za chwilę.
      </p>
      <Button className="mt-4" onClick={() => void router.invalidate()}>
        Spróbuj ponownie
      </Button>
    </main>
  )
}
