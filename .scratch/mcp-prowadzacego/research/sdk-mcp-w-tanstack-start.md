# SDK MCP w TanStack Start

Research do `issues/03-sdk-mcp-w-tanstack-start.md`. Stan na 2026-11-24. Wersje sprawdzone w
rejestrze npm (`npm view`) i w opublikowanych paczkach (`npm pack`, pliki `.d.mts`).

## Wniosek

- Pakiet: **`@modelcontextprotocol/server` 2.x** (dziś 2.4.0), bez adapterów. Ma
  `createMcpHandler`, które zwraca `fetch(Request) => Promise<Response>`. Trasa serwerowa
  TanStack Start dostaje `Request` i oddaje `Response`, więc wystarczy jedna linia w handlerze
  `POST`, tak jak w `src/routes/api/auth/$.ts`.
- Tryb: **bezstanowy**. W specyfikacji 2026-07-28 sesji już nie ma, a `createMcpHandler` tworzy
  świeży `McpServer` na każde żądanie.
- Użytkownik: trasa weryfikuje token (`requireMcpAuth` z `@better-auth/mcp`, zob. ticket 02),
  wczytuje prowadzącego z bazy według tych samych reguł co `sessionUser` i podaje go przez
  `handler.fetch(request, { authInfo: { …, extra: { user } } })`. Fabryka czyta `authInfo` i
  wiąże `user` z narzędziami w domknięciu.
- Schematy: `inputSchema` i `outputSchema` przyjmują schematy zod 4 z `src/schemas/` bez
  konwersji. Wynik zwracamy w `structuredContent`, a SDK sprawdza go przed wysłaniem.
- Elicitation: w 2026-07-28 działa bezstanowo przez **MRTR** (`inputRequired(...)` i ponowienie
  wywołania przez klienta). Klienci 2025 obsługiwani bezstanowo nie dostaną elicitation, więc
  narzędzia nieodwracalne muszą mieć fallback w argumentach (np. `confirmName`, jak dziś w
  `deleteExamSchema`).

## Który pakiet

| Pakiet | Wersja | Specyfikacja | Ocena |
|---|---|---|---|
| `@modelcontextprotocol/sdk` (v1) | 1.32.2 | do 2025-11-25 (`LATEST_PROTOCOL_VERSION = '2025-11-25'`) | linia utrzymaniowa; README: „Support for the 2026-07-28 spec is not planned for v1.x” |
| **`@modelcontextprotocol/server` (v2)** | **2.4.0** (2.0.0 z 2026-07-27) | **2026-07-28** (+ 2025 bezstanowo) | **wybór**; zależności: tylko `zod ^4.2.0` i `@modelcontextprotocol/core` |
| `@modelcontextprotocol/node` | 2.1.2 | — | tylko dla `IncomingMessage`/`ServerResponse`; trasy Start są web-standard, więc niepotrzebny |
| `mcp-handler` (Vercel) | 2.4.0 | 2026-07-28 przez SDK v2 | cienka nakładka na to samo `createMcpHandler`; niczego nam nie dodaje |
| `@tanstack/ai-mcp` | 1.3.1 | przez SDK v2 | własna abstrakcja narzędzi, ciągnie `@tanstack/ai`, `@modelcontextprotocol/client` i peer `@tanstack/ai-harness`; za dużo jak na nasz przypadek |
| `@better-auth/mcp` | 1.7.18 (jak `better-auth`) | — | autoryzacja, nie transport; daje `requireMcpAuth` (temat ticketu 02) |

Sam TanStack Start nie ma wbudowanego MCP. Jest tylko TanStack AI z `@tanstack/ai-mcp`, które
stoi na tym samym SDK v2.

Źródła:
- README `@modelcontextprotocol/server@2.4.0`: „This is v2 of the MCP TypeScript SDK, the
  stable release line, implementing the 2026-07-28 MCP spec” —
  https://www.npmjs.com/package/@modelcontextprotocol/server
- README `@modelcontextprotocol/sdk@1.32.2` (v1.x, utrzymanie; poprawki co najmniej 6 mies. po
  2026-07-27) — https://www.npmjs.com/package/@modelcontextprotocol/sdk
- Dokumentacja serwowania v2 — https://ts.sdk.modelcontextprotocol.io/v2/serving/http
- `mcp-handler` README („Built on MCP SDK v2”) — https://www.npmjs.com/package/mcp-handler
- TanStack AI MCP server — https://tanstack.com/ai/latest/docs/mcp/server
- `@better-auth/mcp` README: „Serve MCP 2026-07-28 requests with version 2 of the official
  `@modelcontextprotocol/server` package, configure `createMcpHandler` with `legacy: "reject"`,
  mount it behind `requireMcpAuth`, and expose only the HTTP `POST` route” —
  https://www.better-auth.com/docs/plugins/mcp

## Bezstanowo czy z sesjami

Specyfikacja 2026-07-28 usuwa sesje (`Mcp-Session-Id`), handshake `initialize`, endpoint GET i
wznawianie SSE. Każde żądanie niesie wersję protokołu i możliwości klienta w `_meta`
(SEP-2567, SEP-2575): https://modelcontextprotocol.io/specification/2026-07-28/changelog

`createMcpHandler(factory, options)`:
- fabryka działa **raz na żądanie HTTP**. Narzędzia rejestrujemy w fabryce, nigdy na wspólnej
  instancji, a pule połączeń trzymamy na poziomie modułu (Prisma `db` już tak działa);
- `legacy: 'stateless'` (domyślnie) obsługuje klientów 2025 bezstanowo z tej samej fabryki,
  a GET i DELETE dostają wtedy 405. `legacy: 'reject'` przyjmuje tylko 2026-07-28;
- `responseMode`: domyślnie przechodzi na SSE dopiero, gdy narzędzie wyśle powiadomienie przed
  wynikiem. `'json'` nigdy nie streamuje. Za nginx w npmplus `'json'` omija buforowanie SSE,
  dopóki nie potrzebujemy progress;
- handler **nie sprawdza** nagłówków `Host`, `Origin` ani tokenu. Robi to trasa przed nim
  (`originValidationResponse` / `hostHeaderValidationResponse` są w SDK, jeśli zechcemy).

Jedna instancja aplikacji niczego tu nie zmienia, bo stanu i tak nie ma.

Źródło: `createMcpHandler-*.d.mts` w `@modelcontextprotocol/server@2.4.0` (opcje `legacy`,
`responseMode`, `McpRequestContext { era, authInfo, requestInfo }`) oraz
https://ts.sdk.modelcontextprotocol.io/v2/serving/http

## Zweryfikowany użytkownik w handlerze narzędzia

- `handler.fetch(request, { authInfo })`: `authInfo` jest „strictly pass-through”, a SDK nie
  czyta go z nagłówków;
- fabryka dostaje `({ authInfo, era, requestInfo })`, a narzędzia mają też `ctx.http.authInfo`;
- `AuthInfo = { token, clientId, scopes, expiresAt?, resource?, extra? }`. Prowadzącego kładziemy
  w `extra.user`;
- `requireMcpAuth(auth, (request, claims) => Response)` z `@better-auth/mcp` sprawdza JWT
  (podpis przez JWKS, issuer, audience, exp) i odsyła 401 z `WWW-Authenticate` (RFC 9728).
  **Weryfikuje tylko JWT**, więc zablokowanie konta albo zdjęcie 2FA zadziała dopiero po
  wygaśnięciu tokenu. Dlatego trasa musi przy każdym żądaniu wczytać użytkownika z bazy według
  reguł z `signedInTeacher`/`sessionUser` (nie `banned`, nie student, `twoFactorReady`). Wymaga
  to małej funkcji `teacherById(id)` obok `signedInTeacher` w `auth.server.ts`, bo dzisiejsza
  działa na nagłówkach sesji.

Alternatywa bez Better Auth: `requireBearerAuth({ verifier, expectedResource })` z SDK zwraca
`AuthInfo | Response`. Weryfikator i tak musiałby pytać Better Auth, więc nie ma powodu.

## Narzędzia ze schematami zod 4 i `outputSchema`

- `registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)`.
  `inputSchema`/`outputSchema` to dowolny **Standard Schema z JSON Schema**
  (`StandardSchemaWithJSON`); zod 4 to spełnia. Druga przeciążona wersja przyjmuje też surowy
  kształt `{ pole: z.string() }`. Repo ma `zod 4.6.7`, SDK wymaga `^4.2.0`. Zgodne;
- SDK sam generuje JSON Schema dla `tools/list`, waliduje argumenty przed handlerem (błąd →
  `isError: true` „Input validation error”) i waliduje `structuredContent` przed wysłaniem. Gdy
  pominiemy `content`, wyśle JSON `structuredContent` jako blok tekstowy;
- sprawdzone lokalnie na zod 4.6.7 z repo: obiekt z `.refine` (jak `examFormSchema`),
  `.and(examIdSchema)` i `.extend` dają JSON Schema z `type: "object"` w korzeniu, a `.refine`
  działa dalej przy walidacji. Schematy z `src/schemas/` nadają się więc wprost jako
  `inputSchema`;
- uwagi do `outputSchema` (dokumentacja SDK): pola z `.default()` trzeba zwracać, `.transform`
  i koercje nie pomagają. **Prisma zwraca `Date`** (np. `enrollmentOpensAt` w `examsOf`), a
  `z.date()` nie ma odpowiednika w JSON Schema. Wyniki ops trzeba więc mapować na stringi ISO
  i opisać schematem `z.iso.datetime()`. Te schematy wyjścia są nowe, bo `src/schemas/` opisuje
  dziś tylko wejście;
- `structuredContent` w 2026-07-28 może być dowolną wartością JSON (SEP-2106), ale klienci 2025
  wymagają obiektu. Listy owijamy więc w obiekt, np. `{ exams: [...] }`;
- `annotations`: `readOnlyHint`, `destructiveHint`, `idempotentHint` (SDK ich nie egzekwuje,
  tylko je ogłasza).

Źródła: https://ts.sdk.modelcontextprotocol.io/v2/servers/tools, sygnatury `registerTool` w
`mcp-*.d.mts` (`@modelcontextprotocol/server@2.4.0`).

## Elicitation w trybie bezstanowym

- 2026-07-28 nie ma już kanału żądań serwer → klient. Zamiast `elicitation/create` serwer
  zwraca `InputRequiredResult` (`resultType: "input_required"`), a klient ponawia wywołanie z
  `inputResponses` (MRTR, SEP-2322). To z natury działa bez sesji;
- w SDK v2: `return inputRequired({ inputRequests: { confirm: inputRequired.elicit({ message,
  requestedSchema: zodSchema }) } })`. Przy ponowieniu odpowiedź czytamy przez
  `acceptedContent(ctx.mcpReq.inputResponses, 'confirm', zodSchema)` albo `inputResponse(...)`,
  które odróżnia odmowę od braku odpowiedzi. Stan między rundami trzymamy w `requestState`,
  podpisanym przez `createRequestStateCodec` (HMAC). `ctx.mcpReq.elicitInput` (styl 2025)
  **rzuca błąd** dla żądań 2026-07-28;
- brak możliwości `elicitation` u klienta → błąd `-32021` przed wysłaniem czegokolwiek, więc
  potrzebny fallback;
- **klienci 2025 przez bezstanowy fallback nie dostaną elicitation.** Shim `legacyShim`
  wysyła prawdziwe `elicitation/create` tylko w połączeniu 2025 z sesją, a .d.mts mówi wprost:
  „Per-request instances that never saw an initialize (stateless legacy) hold nothing, so
  gates refuse there”. Pełne elicitation dla klientów 2025 wymagałoby osobnej, stanowej trasy
  (`isLegacyRequest` + `WebStandardStreamableHTTPServerTransport` z sesjami). Nie warto.

Źródła: https://ts.sdk.modelcontextprotocol.io/v2/servers/input-required, komentarze
`ServerOptions.inputRequired.legacyShim` i `_inputRequestCapabilityView` w `mcp-*.d.mts`,
changelog specyfikacji (punkty 7, 8, 11).

## Szkic trasy

```ts
// src/routes/mcp.ts
import { requireMcpAuth } from "@better-auth/mcp"
import { createFileRoute } from "@tanstack/react-router"

import { auth, teacherById } from "@/server/auth.server" // teacherById: nowa, reguły jak sessionUser
import { mcpHandler } from "@/server/mcp.server"

const serve = requireMcpAuth(auth, async (request, claims) => {
  const user = claims.sub ? await teacherById(claims.sub) : null // zablokowany / bez 2FA = brak
  if (!user) return Response.json({ error: "invalid_token" }, { status: 401 })
  return mcpHandler.fetch(request, {
    authInfo: {
      token: "", // tokenu dalej nie potrzebujemy
      clientId: String(claims.azp ?? claims.client_id ?? ""),
      scopes: [],
      expiresAt: claims.exp,
      extra: { user },
    },
  })
})

export const Route = createFileRoute("/mcp")({
  server: { handlers: { POST: ({ request }) => serve(request) } },
})
```

```ts
// src/server/mcp.server.ts
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { deleteExamSchema } from "../schemas/exam.ts"
import { examsOf, removeExam } from "./exam-ops.server.ts"

type Teacher = { id: string; name: string; email: string; isAdmin: boolean }

export const mcpHandler = createMcpHandler(
  ({ authInfo }) => {
    const user = authInfo?.extra?.user as Teacher // ustawia trasa /mcp, bez niej nie ma żądania
    const server = new McpServer({ name: "terminus", version: "1.0.0" })

    server.registerTool(
      "list_exams",
      {
        description: "Zaliczenia, które prowadzę.",
        outputSchema: z.object({ exams: z.array(z.object({ id: z.uuid(), name: z.string() })) }),
        annotations: { readOnlyHint: true },
      },
      async () => {
        const exams = await examsOf(user.id)
        return { structuredContent: { exams: exams.map(({ id, name }) => ({ id, name })) } }
      },
    )

    server.registerTool(
      "delete_exam",
      {
        description: "Usuń zaliczenie. confirmName musi być dokładną nazwą zaliczenia.",
        inputSchema: deleteExamSchema, // ten sam schemat co w createServerFn
        outputSchema: z.object({ deleted: z.literal(true) }),
        annotations: { destructiveHint: true },
      },
      async ({ examId, confirmName }) => {
        await removeExam(examId, { teacher: user.id }, confirmName)
        return { structuredContent: { deleted: true as const } }
      },
    )

    return server
  },
  { responseMode: "json" }, // bez SSE za nginx, dopóki nie potrzebujemy progress
)
```

Wzór jest ten sam co w `src/server/*.ts`: walidacja schematem z `src/schemas/`, a potem
wywołanie `*-ops.server.ts` z `user.id`. Rolę middleware `requireUser` przejmuje trasa
(`teacherById`). Błędy rzucane przez ops (np. `ACCESS_DENIED`) SDK zamienia na wynik
narzędzia z błędem. Szczegóły na stronie Errors SDK, której nie czytałem.

## Niepotwierdzone / do sprawdzenia

- Czy klienci, których użyje prowadzący (Claude.ai, Claude Code, inni), mówią już 2026-07-28.
  Nie sprawdzałem, to temat ticketu 01. Od tego zależy `legacy: 'stateless'` (domyślne,
  zgodność z 2025) kontra `legacy: 'reject'` (zalecane przez README `@better-auth/mcp`).
  Rekomendacja: zostawić domyślne, dopóki testy nie pokażą, że wszyscy mówią 2026.
- Kształt `claims` z `requireMcpAuth` (`sub`, `azp`/`client_id`, `exp`) i to, czy `sub` to
  `user.id` Better Auth. To temat ticketu 02.
- Czy TanStack Start (Nitro 3 rc) bez buforowania przepuszcza strumień SSE z `Response`.
  Dokumentacja tras serwerowych o tym milczy; `responseMode: 'json'` omija problem.
- Czy trasa bez handlera `GET` zwraca 405. Klient 2026 nie używa GET, a klient 2025 bez sesji
  dostałby 405 od SDK, jeśli podepniemy GET do handlera.
- Jak SDK raportuje rzucony `Error` z handlera narzędzia (strona
  https://ts.sdk.modelcontextprotocol.io/v2/servers/errors, nieprzeczytana).
- Trasa `/.well-known/oauth-protected-resource`: nazwa pliku `[.]well-known` w routerze to
  ekstrapolacja z dokumentacji (`users[.]json.ts`). Metadane może też serwować sam Better Auth.
  To temat ticketu 02.
