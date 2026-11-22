import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"

import { signOutWithToast } from "@/lib/auth-client"
import { sessionQuery } from "@/server/session"

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    if (!(await signOutWithToast())) return
    queryClient.removeQueries({ queryKey: sessionQuery().queryKey })
    await router.navigate({ to: "/login" })
    queryClient.clear()
  }
}
