# TanStack Start z Better Auth

Type: research
Status: resolved

## Question

Jak w aktualnej wersji TanStack Start zbudować aplikację z Better Auth?
Konkretnie: oficjalny sposób integracji (handler, sesja w server functions,
ochrona tras), czy plugin `admin` Better Auth pozwala wyłączyć publiczną
rejestrację, zakładać konta przez superadmina i resetować hasła bez wysyłki
maili, jak utworzyć pierwszego superadmina z env, czy Better Auth ma wbudowany
rate limiting użyteczny także dla niezalogowanych tras, oraz jak zbudować
i uruchomić TanStack Start jako serwer Node w kontenerze Docker.

## Answer

Pełne wyniki ze źródłami: [research/tanstack-start-better-auth.md](../research/tanstack-start-better-auth.md).

Potwierdzone w dokumentacji:

- TanStack Start 1.168.59 (2026-09-27), formalnie wciąż Release Candidate; wymaga Node >=22.12 i Vite >=7.
- Better Auth 1.7.6. Integracja: trasa `src/routes/api/auth/$.ts` wołająca `auth.handler(request)`, plugin `tanstackStartCookies()` jako ostatni, sesja w server functions przez `auth.api.getSession({ headers: getRequestHeaders() })`, ochrona tras przez `beforeLoad` + `redirect` oraz sprawdzenie sesji w każdej server function.
- `emailAndPassword.disableSignUp: true` wyłącza publiczną rejestrację. Plugin `admin`: `createUser`, `setUserPassword` (bez maila), role.
- Plugin `admin` nie ma opcji wymuszenia zmiany hasła przy pierwszym logowaniu.
- Pierwszy admin: CLI `create-admin` albo `auth.api.createUser` wołane po stronie serwera.
- Rate limiting Better Auth działa tylko dla tras `/api/auth/*`. Dla reszty: `rate-limiter-flexible` 11.2.1.
- Serwer Node: plugin `nitro()` w `vite.config.ts`, `vite build`, start `node .output/server/index.mjs`, port z `PORT`. Nitro v3 jest w wersji beta.

Wnioski niepotwierdzone, do sprawdzenia testem na początku budowy:

- `createUser` działa przy `disableSignUp: true` (wynika z kodu źródłowego, dokumentacja milczy).
- Idempotentny skrypt seed czytający `ADMIN_EMAIL` / `ADMIN_PASSWORD`, uruchamiany po migracjach.
- `.output` nie zawiera CLI Prisma ani kodu seed — sposób uruchamiania migracji i seed rozstrzyga zadanie o wdrożeniu.
- Zgodność adaptera Prisma w Better Auth z Prisma 8 niezweryfikowana tutaj (npm `prisma@latest` to `8.0.0-rc.19`).

## Comments

- Wyniki tego zadania zakładają `prismaAdapter(...)` oraz `prisma generate` / `prisma migrate deploy`. W Prisma 8 żadne z nich nie istnieje — patrz [Prisma 8 z PostgreSQL](01-prisma-8-z-postgresql.md). Reszta ustaleń pozostaje w mocy.
