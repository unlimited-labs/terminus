# TanStack Start + Better Auth — wyniki researchu

Stan na 2026-09-30. Ticket: `.scratch/zapisy/issues/02-tanstack-start-z-better-auth.md`.

Oznaczenia: **[P]** potwierdzone w źródle pierwotnym (link obok), **[W]** wniosek własny, niepotwierdzony wprost w dokumentacji.

Numery linii `routes.ts` dotyczą pliku z gałęzi `main` pobranego 2026-09-30:
<https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/plugins/admin/routes.ts>

## 1. Stan TanStack Start i integracja z Better Auth

- **[P]** `@tanstack/react-start` `latest` = 1.168.59, opublikowany 2026-09-27; wymaga Node `>=22.12.0`, Vite `>=7` (albo Rsbuild 2), React 18 lub 19. Node 24 spełnia wymóg. — <https://registry.npmjs.org/@tanstack/react-start>
- **[P]** Dokumentacja nadal opisuje status jako "Release Candidate": "considered feature-complete and its API is considered stable". — <https://tanstack.com/start/latest/docs/framework/react/overview>
- **[P]** Ogłoszenie RC pochodzi z 2025-09-23 i nie zostało zaktualizowane o wydanie 1.0. — <https://tanstack.com/blog/announcing-tanstack-start-v1>
- **[W]** Czyli: numeracja 1.x, API deklarowane jako stabilne, ale formalnie wciąż RC od roku. W specyfikacji przypiąć dokładne wersje.
- **[P]** Better Auth `latest` = 1.7.6 (2026-09-24). — <https://registry.npmjs.org/better-auth>

Integracja (wszystko **[P]** z <https://www.better-auth.com/docs/integrations/tanstack>):

- Handler: plik `src/routes/api/auth/$.ts`, `createFileRoute('/api/auth/$')({ server: { handlers: { GET, POST } } })`, oba wywołują `auth.handler(request)`.
- Plugin `tanstackStartCookies()` z `better-auth/tanstack-start`, musi być ostatni w tablicy `plugins` — ustawia ciasteczka przy wywołaniach typu `signInEmail` po stronie serwera.
- Sesja w server function: `auth.api.getSession({ headers: getRequestHeaders() })`, gdzie `getRequestHeaders` pochodzi z `@tanstack/react-start/server`. Dokumentacja pokazuje dwie funkcje: `getSession` i `ensureSession` (rzuca błąd bez sesji).
- Ochrona tras: `beforeLoad` w trasie (lub w trasie-layoucie) woła `getSession` i robi `throw redirect(...)`. Ochrona danych: `ensureSession` na początku każdej server function.

Uzupełnienie z dokumentacji TanStack:

- **[P]** Wzorzec layoutu `_authed.tsx` z `beforeLoad` + `redirect({ to: '/login', search: { redirect: location.href } })`; zasada "Protect the data/API boundary first" — sam `beforeLoad` nie wystarcza, autoryzacja musi być w server functions. — <https://tanstack.com/start/latest/docs/framework/react/guide/authentication>
- **[P]** Middleware: `createMiddleware({ type: 'function' }).server(({ next }) => next({ context }))`; globalne przez `createStart` w `src/start.ts` (`requestMiddleware`, `functionMiddleware`). — <https://tanstack.com/start/latest/docs/framework/react/guide/middleware>
- **[W]** Dla tej aplikacji wystarczy `ensureSession` + sprawdzenie właściciela egzaminu w każdej server function wykładowcy; middleware jest opcjonalne.

Adapter Prisma:

- **[P]** `prismaAdapter(prisma, { provider: "postgresql" })` z `better-auth/adapters/prisma`; schemat generuje `npx auth@latest generate`. Dokumentacja jest pisana pod Prisma 7. — <https://www.better-auth.com/docs/adapters/prisma>
- **Niezweryfikowane:** zgodność adaptera z Prisma 8. W npm `prisma@latest` wskazuje dziś na `8.0.0-rc.19` (<https://registry.npmjs.org/prisma/latest>). To poza zakresem tego ticketu, ale wymaga sprawdzenia.

## 2. Plugin `admin`

- **[P]** Wyłączenie publicznej rejestracji: `emailAndPassword: { enabled: true, disableSignUp: true }`. — <https://www.better-auth.com/docs/reference/options>
- **[P]** Admin tworzy użytkownika: `auth.api.createUser({ body: { email, password, name, role?, data? } })` / `authClient.admin.createUser(...)`. — <https://www.better-auth.com/docs/plugins/admin>
- **[W, z kodu]** `createUser` działa przy `disableSignUp: true`: w `routes.ts` nie ma żadnego odwołania do `disableSignUp`, endpoint tworzy użytkownika i konto `credential` bezpośrednio, z pominięciem endpointu sign-up. Dokumentacja nie mówi tego wprost — sprawdzić testem przy implementacji.
- **[P]** Reset hasła bez maila: `auth.api.setUserPassword({ body: { userId, newPassword }, headers })` / `authClient.admin.setUserPassword(...)`. — <https://www.better-auth.com/docs/plugins/admin>
- **[P, kod]** `setUserPassword` używa `adminMiddleware`, które zawsze wymaga sesji (linie 37–41, 1677–1682). Czyli reset hasła tylko z żądania zalogowanego admina, nie ze skryptu bez sesji.
- **[P]** Role: pole `role` w tabeli `user`; opcje `defaultRole` (domyślnie `user`), `adminRoles` (domyślnie `["admin"]`), `adminUserIds`; `setRole`; własne role i uprawnienia przez access control. Plugin dodaje też `banned`, `banReason`, `banExpires` oraz `impersonatedBy` w sesji. Są też `revokeUserSessions`, `banUser`, `removeUser`. — <https://www.better-auth.com/docs/plugins/admin>
- **[P]** Wymuszenie zmiany hasła przy pierwszym logowaniu: dokumentacja pluginu `admin` nic o tym nie mówi (brak takiej opcji). — <https://www.better-auth.com/docs/plugins/admin>
- **[W]** Jeśli potrzebne: własne pole boolean na użytkowniku (`user.additionalFields`), sprawdzane w `beforeLoad` layoutu `_authed` i zerowane po `changePassword`. Rozważyć, czy w ogóle potrzebne — superadmin może po prostu przekazać hasło i poprosić o zmianę.
- **[W]** Mapowanie na dziedzinę: superadmin = rola `admin`, wykładowca = rola `user`.

## 3. Pierwszy admin z env

- **[P]** Udokumentowany sposób to CLI: `npx auth@latest create-admin --email ... --name "Admin" --role admin`. Opcje: `--password` (bez niej CLI pyta interaktywnie), `--config`, `--force`, `--yes`, `--no-email-verified`. Korzysta z tej samej ścieżki co `auth.api.createUser`, więc hasło jest hashowane. Gdy istnieją już użytkownicy, pyta o potwierdzenie. — <https://www.better-auth.com/docs/concepts/cli>, <https://www.better-auth.com/docs/plugins/admin>
- **[P, kod]** `auth.api.createUser` wywołane po stronie serwera bez `headers` omija sprawdzenie sesji: `if (!session && (ctx.request || ctx.headers)) throw UNAUTHORIZED` (linie 340–345). Tak właśnie działa CLI.
- **[W]** Zalecenie: krótki skrypt seed uruchamiany przy starcie kontenera, czyta `ADMIN_EMAIL` / `ADMIN_PASSWORD` z env, sprawdza w bazie, czy użytkownik o tym e-mailu istnieje, a jeśli nie — woła `auth.api.createUser({ body: { ..., role: "admin" } })`. Kolejność w kontenerze: `prisma migrate deploy` → seed → `node .output/server/index.mjs`.
- **[W]** CLI w kontenerze jest gorszym wyborem: wymaga `--password` w linii poleceń i `--yes`, a zachowanie przy ponownym uruchomieniu z tym samym e-mailem nie zostało zweryfikowane. Własny skrypt jest jawnie idempotentny.

## 4. Rate limiting

- **[P]** Better Auth ma wbudowany limiter: domyślnie włączony w produkcji, okno 60 s, 100 żądań; `customRules` per ścieżka; magazyn `memory` (domyślny), `database` lub własny; odpowiedź 429 z `X-Retry-After`. — <https://www.better-auth.com/docs/concepts/rate-limit>
- **[P]** "Server-side requests made using `auth.api` aren't affected by rate limiting. Rate limits only apply to client-initiated requests." — tamże.
- **[P]** IP brany z `x-forwarded-for`; łańcuchy po przecinku nie są domyślnie zaufane. Za reverse proxy ustawić `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]` albo `trustedProxies`; proxy musi nadpisywać nagłówek. — tamże.
- **[W]** Limiter nie obejmie publicznej strony zapisu: działa wewnątrz `auth.handler`, czyli tylko dla ścieżek `/api/auth/*`. Dokumentacja nie opisuje użycia dla tras spoza auth.
- **[P]** `rate-limiter-flexible` — 11.2.1, wydany 2026-09-17, niezależny od frameworka, magazyny: pamięć, Redis/Valkey, PostgreSQL, Prisma i inne; API `consume(klucz)`. — <https://github.com/animir/node-rate-limiter-flexible>, <https://registry.npmjs.org/rate-limiter-flexible>
- **[W]** Zalecenie: `RateLimiterMemory` wywoływany na początku publicznej server function zapisu, klucz = IP z nagłówka ustawianego przez reverse proxy. Pamięć wystarcza przy jednej instancji na VPS (licznik zeruje się po restarcie). Alternatywa bez zależności: limit w reverse proxy (nginx `limit_req`, Caddy).
- **[W]** Właściwą ochroną przed podwójnym zapisem jest unikalny constraint w bazie (egzamin + numer albumu); limiter chroni tylko przed zgadywaniem numerów i zalewaniem żądaniami.

## 5. Build i uruchomienie jako serwer Node w Dockerze

- **[P]** Dla Vite dokumentacja kieruje na Nitro: `npm install nitro`, w `vite.config.ts` `plugins: [tanstackStart(), nitro(), viteReact()]` (`nitro` z `nitro/vite`, `tanstackStart` z `@tanstack/react-start/plugin/vite`). Skrypty: `"build": "vite build"`, `"start": "node .output/server/index.mjs"`. — <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>
- **[P]** Ostrzeżenie z tej samej strony: plugin `nitro/vite` "is still under active development and receives regular updates". `nitro@latest` w npm to `3.0.260903-beta` (2026-09-03). — <https://registry.npmjs.org/nitro>
- **[P]** Preset `node_server` jest domyślny; katalog `.output` jest samodzielny; port z `NITRO_PORT` lub `PORT` (domyślnie 3000), host z `NITRO_HOST` lub `HOST`; obsługa SIGINT/SIGTERM z 30 s na zamknięcie; TLS ma kończyć reverse proxy. — <https://nitro.build/deploy/runtimes/node>
- **[P]** Alternatywa bez Nitro jest udokumentowana tylko dla Rsbuild: `dist/client` + `dist/server/index.js` eksportujący handler `fetch`, uruchamiany przez `srvx --prod -s ../client dist/server/index.js`. — <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>
- **[W]** Dockerfile: wieloetapowy na `node:24-slim`; etap build: `corepack enable`, `pnpm install --frozen-lockfile`, `prisma generate`, `pnpm build`; etap runtime: skopiować `.output`, ustawić `HOST=0.0.0.0`, `PORT=3000`, `CMD ["node", ".output/server/index.mjs"]`. Dokumentacja TanStack nie zawiera przykładowego Dockerfile.
- **[W]** Migracje i seed potrzebują w obrazie runtime CLI Prisma, schematu oraz kodu `auth` — samo `.output` tego nie zawiera. Najprościej zostawić w obrazie `node_modules` i źródła albo uruchamiać migracje osobną usługą w compose z obrazu etapu build. Do rozstrzygnięcia w specyfikacji.
- **[W]** Zmienne env czytane przez `process.env` w kodzie serwera są odczytywane w czasie działania, więc konfiguracja z compose działa bez przebudowy obrazu; zmienne `VITE_*` są wklejane przy buildzie. Wymagane dla Better Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, plus `DATABASE_URL`.

## Ryzyka do odnotowania w specyfikacji

1. TanStack Start formalnie RC, Nitro v3 w becie — przypiąć wersje w `package.json`.
2. Prisma 8 jest dziś w stadium RC, a adapter Better Auth udokumentowany dla Prisma 7 — do weryfikacji.
3. `createUser` przy `disableSignUp: true` oraz idempotencja seeda — potwierdzić testem na początku implementacji.
