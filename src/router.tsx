import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { ErrorPage, NotFoundPage } from "./components/error-page"
import { ACCESS_DENIED } from "./messages.pl"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  // staleTime > 0: dane z SSR nie są pobierane drugi raz zaraz po hydracji; świeżość dają unieważnienia po mutacjach.
  // Sesja wygasła lub odebrana, a `beforeLoad` wziął ją z cache: zamiast strony błędu logowanie.
  const onError = (error: Error) => {
    if (error.message !== ACCESS_DENIED || typeof window === "undefined") return
    // Student na stronie zapisów wraca do ekranu logowania tego zaliczenia, nie do logowania prowadzących.
    if (router.state.location.pathname.startsWith("/z/")) {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] })
      return
    }
    queryClient.clear()
    void router.navigate({ to: "/login", search: { redirect: router.state.location.href } })
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Dane trzyma Query; loader przy preloadzie ma zawsze sięgać do jego cache.
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
