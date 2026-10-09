<p align="center">
  <img src="docs/assets/logo.png" width="96" alt="Terminus">
</p>

<h1 align="center">Terminus</h1>

<p align="center">System zapisów na zaliczenia z losowym przydziałem terminów.</p>

## Opis

Terminus przydziela studentom terminy zaliczeń w sposób losowy. Prowadzący
importuje listy studentów z systemu uczelni i definiuje przedziały czasu, które
system dzieli na sloty o zadanej długości. Student otwiera link zaliczenia,
podaje numer indeksu (własny lub numery całego zespołu) i otrzymuje
wylosowany slot. Przydział jest ostateczny, a harmonogram jest jawny dla
wszystkich posiadaczy linku.

## Funkcje

- Import list studentów z plików CSV, z podglądem zmian przed zapisaniem.
- Generowanie slotów z okien czasowych.
- Zapisy indywidualne i zespołowe, z opcjonalnymi polami wypełnianymi przy zapisie.
- Tablica zapisów do ręcznego przenoszenia i usuwania przydziałów.
- Wspólne zarządzanie zaliczeniem przez kilku prowadzących.
- Eksport wyników do CSV.
- Zarządzanie kontami prowadzących przez superadministratora.

Studenci nie zakładają kont; identyfikuje ich wyłącznie numer indeksu.

## Wymagania

- Node.js 24
- pnpm 12
- Docker (lokalna baza PostgreSQL i testy)

## Uruchomienie lokalne

```sh
pnpm install
pnpm db:up
cp .env.example .env
pnpm exec prisma migrate dev
pnpm seed-admin
pnpm dev
```

Przed migracją należy uzupełnić w `.env` co najmniej `DATABASE_URL`
(dla bazy lokalnej: `postgresql://zapisy:zapisy@localhost:55432/zapisy`),
`BETTER_AUTH_SECRET`, `APP_PUBLIC_URL` (lokalnie `http://localhost:3000`)
oraz dane pierwszego konta w `ADMIN_EMAIL`,
`ADMIN_PASSWORD` i `ADMIN_NAME`. Aplikacja jest dostępna pod adresem
http://localhost:3000.

## Polecenia

| Polecenie                     | Opis                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                    | Serwer deweloperski                                                       |
| `pnpm check`                  | Lint, formatowanie, kontrola typów, testy jednostkowe i bazodanowe, build |
| `pnpm e2e`                    | Testy end-to-end (Playwright)                                             |
| `pnpm db:up` / `pnpm db:down` | Uruchomienie i zatrzymanie lokalnej bazy                                  |
| `pnpm reset-password <email>` | Nowe hasło dla konta prowadzącego                                         |

## Technologie

TanStack Start, React 19, Prisma 7, PostgreSQL, Better Auth, Tailwind CSS 4,
shadcn/ui.

## Dokumentacja

- `SPEC.md` — specyfikacja funkcjonalna
- `CONTEXT.md` — słownik pojęć domenowych
- `docs/adr/` — decyzje architektoniczne
