# Architektura i układ plików

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 15

## Question

Jak podzielony jest kod i gdzie co leży? Układ katalogów (trasy, server
functions, logika domenowa, dostęp do bazy, komponenty UI, schematy
walidacji). Gdzie żyje logika losowania i przenoszenia zapisów, tak żeby dała
się testować bez przeglądarki i bez serwera HTTP? Gdzie sprawdzane są
uprawnienia (prowadzący widzi tylko swoje zaliczenia) — w jednym miejscu, nie
w każdej trasie. Jak dane płyną między serwerem a klientem (loadery, TanStack
Query, odświeżanie tablicy po przeciągnięciu, optymistyczne aktualizacje)?
Obsługa błędów i komunikaty po polsku. Które zalecenia z dokumentacji TanStack
Start, Prisma i Better Auth przyjmujemy jako obowiązujące? Potwierdzić, że
shadcn/ui w wariancie Base UI z Tailwind v4 instaluje się na TanStack Start
(otwarty błąd instalatora #11015).

## Answer

- Układ: `src/routes/` (cienkie trasy: loader + komponent; `z/$examId.tsx`, `_authed/…`, `api/auth/$.ts`), `src/domain/` (czysta logika bez bazy i HTTP: losowanie, reguły tablicy, cięcie okna, parsowanie CSV), `src/server/` (tylko serwer: `db.ts`, `auth.ts`, moduły wczytaj → `domain/` → zapisz), `src/components/` (shadcn w `components/ui`), `src/schemas/` (Zod wspólny dla formularzy i serwera). Podział po rodzaju, nie po funkcji.
- Losowanie i tablica: czyste funkcje `domain/draw.ts` (wolne sloty, "teraz", generator losowy → slot albo powód odmowy) i `domain/board.ts` (stan + operacja → zmiany albo błąd); `server/enrollment.ts` i `server/board.ts` biorą blokadę zaliczenia, wczytują, wołają domenę, zapisują. Dostęp do bazy tylko w `server/`.
- Uprawnienia: middleware `requireUser` na każdej funkcji serwerowej prowadzącego (sesja, zablokowane konto = odmowa), `requireAdmin` dla funkcji superadmina; każde zapytanie o zaliczenie przez `getOwnedExam(userId, examId)`, które dla cudzego zaliczenia zwraca "nie znaleziono". `beforeLoad` tylko przekierowuje na logowanie.
- Dane: loadery wypełniają cache TanStack Query, komponenty czytają `useQuery`, zmiany przez `useMutation` → funkcje serwerowe. Tablica: aktualizacja optymistyczna; serwer zwraca cały stan tablicy, który zastępuje cache; przy błędzie cofnięcie i komunikat.
- Świeżość: tablica i harmonogram odświeżane przy powrocie do karty i co 30 s przy widocznej karcie; bez WebSocketów.
- Wzorce projektowe stosujemy, gdy upraszczają kod (zasada użytkownika). Już przyjęte: funkcyjny rdzeń + imperatywna powłoka (`domain/` czyste, `server/` z bazą); wstrzykiwanie "teraz" i generatora losowego do `domain/draw.ts` (testy deterministyczne); operacje tablicy jako polecenia (Command): obiekt `{ kind, … }` walidowany i stosowany przez `domain/board.ts`, a każde polecenie zwraca polecenie odwrotne, którym działa "Cofnij"; wynik zamiast wyjątków dla błędów domeny (`{ ok: false, code }`); jedna brama dostępu do zaliczeń (`getOwnedExam`). Bez warstw i interfejsów "na zapas".
- Błędy: domena zwraca kody (`SLOT_FULL`, `NOT_ON_ROSTER`, `ALREADY_ENROLLED`, …) z danymi; jeden słownik `messages.pl.ts` → zdania po polsku. Teksty UI wpisane w komponentach, bez biblioteki tłumaczeń. Nieoczekiwany błąd → ogólny komunikat + log kontenera.
- shadcn: projekt zakładany szablonem `pnpm dlx shadcn@latest init -t start --base base`; jeśli wystąpi błąd #11015 (nadal otwarty, poprawka PR #11021 niescalona, `shadcn` 4.21.0 z 2026-09-04), instalacja ręczna wg https://ui.shadcn.com/docs/installation/manual.
- Baza: osobna baza danych `zapisy` (własny użytkownik) we wspólnym kontenerze PostgreSQL, tabele w `public` tej bazy — zamiast schematu `zapisy` we wspólnej bazie. Powód: `@prisma/adapter-pg` w Prisma 7 ignoruje `?schema=` w URL (https://github.com/prisma/prisma/issues/28128), schemat trzeba podawać w konstruktorze adaptera, a zachowanie migracji nie jest opisane. Zmienia to odpowiedź zadania [Wdrożenie na VPS](11-wdrozenie-na-vps.md). Prisma 7 obsługuje PostgreSQL 9.6–18.
- Wersje przypięte dokładnie (bez `^`): `prisma`, `@prisma/client`, `@prisma/adapter-pg` 7.x (`prisma@latest` w npm to 8.0.0-rc!), `@tanstack/react-start`, `@dnd-kit/react` 0.5.0, `nitro` (beta). Aktualizacje świadomie skillem `update-deps`.
- Obowiązujące zalecenia z dokumentacji: TanStack Start — `createMiddleware().server(...)` podpinany `.middleware([requireUser])` do każdej funkcji serwerowej wymagającej logowania; Query przez `@tanstack/react-router-ssr-query` + `setupRouterSsrQueryIntegration({ router, queryClient })`, loadery `context.queryClient.ensureQueryData(...)`. Better Auth — `tanstackStartCookies()` ostatni, sesja `auth.api.getSession({ headers })`. Prisma — jeden klient na proces w `server/db.ts`.
