import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { ErrorPage, NotFoundPage } from "./components/error-page"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  // staleTime > 0: dane z SSR nie są pobierane drugi raz zaraz po hydracji; świeżość dają unieważnienia po mutacjach.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
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
