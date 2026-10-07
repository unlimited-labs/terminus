import type { QueryClient } from "@tanstack/react-query"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { createIsomorphicFn } from "@tanstack/react-start"

import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url"

// og:image musi mieć pełny adres; crawlery czytają tylko HTML z serwera.
const origin = createIsomorphicFn()
  .server(() => process.env.BETTER_AUTH_URL ?? "")
  .client(() => window.location.origin)

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Terminus — zapisy na zaliczenia" },
      { property: "og:title", content: "Terminus — zapisy na zaliczenia" },
      { property: "og:description", content: "Zapisy studentów na terminy zaliczeń." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${origin()}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>",
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl p-6 pt-16">
      <h1 className="text-2xl font-extrabold">Nie znaleziono strony</h1>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" />
        <Scripts />
      </body>
    </html>
  )
}
