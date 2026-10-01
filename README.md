# Terminus — zapisy na zaliczenia

Prowadzący tworzy zaliczenie, importuje listy indeksów i definiuje sloty; student
wchodzi na link zaliczenia, podaje numer indeksu (swój albo zespołu) i dostaje
wylosowany slot. Specyfikacja: `SPEC.md`, słownik pojęć: `CONTEXT.md`.

## Praca lokalna

Wymagane: Node 24, pnpm 12, Docker (baza i testy na Testcontainers).

```sh
pnpm db:up                    # PostgreSQL z compose.dev.yaml na localhost:55432 (zapisy/zapisy)
cp .env.example .env          # DATABASE_URL=postgresql://zapisy:zapisy@localhost:55432/zapisy, sekret, ADMIN_*
pnpm install
pnpm exec prisma migrate dev  # schemat bazy
pnpm seed-admin               # pierwszy superadmin z ADMIN_*
pnpm dev                      # http://localhost:3000
```

| Polecenie                     | Co robi                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm db:up` / `pnpm db:down` | lokalna baza deweloperska (`compose.dev.yaml`, dane w wolumenie `zapisy-dev-db`)                         |
| `pnpm check`                  | oxlint, oxfmt, tsc, fallow, react-doctor, testy jednostkowe i bazodanowe, build                          |
| `pnpm e2e`                    | Playwright na zbudowanej aplikacji i świeżej bazie w kontenerze                                          |
| `pnpm release`                | `check` + `e2e`, potem obraz `linux/amd64` z tagiem z gita, wysłany do rejestru (`IMAGE=… pnpm release`) |
| `pnpm reset-password <email>` | nowe losowe hasło dla konta, wylogowuje jego sesje                                                       |

Pliki `src/server/*.server.ts` to kod tylko serwerowy (Prisma, Better Auth);
build przerywa się, gdy kod przeglądarki próbuje go zaimportować.

## Baza danych na VPS (raz, ręcznie)

We wspólnym kontenerze PostgreSQL (wersja 9.6–18 — wymóg Prisma 7) jako
superużytkownik:

```sql
CREATE USER zapisy WITH PASSWORD 'silne-haslo';
CREATE DATABASE zapisy OWNER zapisy;
REVOKE ALL ON DATABASE zapisy FROM PUBLIC;
```

Tabele powstają w schemacie `public` tej bazy przy starcie kontenera aplikacji
(`prisma migrate deploy`). Kopie zapasowe są po stronie właściciela wspólnej bazy.

## Wdrożenie

Na VPS są tylko `compose.yaml` i `.env` (wzór: `.env.example`). Aplikacja nie
wystawia portów; NPMplus łączy się z nią po nazwie kontenera `terminus`, port
3000, w zewnętrznej sieci `PROXY_NETWORK`. Baza jest osiągalna w sieci
`DB_NETWORK`.

1. Lokalnie: `IMAGE=registry.wimiip.eu/terminus pnpm release` — wypisze tag.
2. Na VPS: `IMAGE_TAG=<tag>` w `.env`, potem `docker compose up -d`.
3. Wycofanie: poprzedni tag w `.env` i `docker compose up -d`.

Przy starcie kontener wykonuje migracje, zakłada superadmina z `ADMIN_*`, jeśli
tego e-maila nie ma w bazie (istniejącego konta nie zmienia), i uruchamia serwer.

Przed pierwszym uruchomieniem sprawdzić na VPS:

- wersję PostgreSQL (`SELECT version();`, Prisma 7 obsługuje 9.6–18);
- że NPMplus nadpisuje nagłówek `X-Real-IP` adresem klienta (limit prób zapisu
  liczy się po tym adresie; gdyby nagłówek przychodził od klienta, limit można
  obejść);
- akceptację klauzuli RODO (`docs/klauzula-informacyjna.md`) przez Inspektora
  Ochrony Danych AGH.

## Utracone hasło

Superadmin ustawia nowe hasło innemu prowadzącemu w zakładce „Konta”. Gdy nie ma
innego superadmina:

```sh
docker compose exec app pnpm reset-password <email>
```

Polecenie wypisuje nowe losowe hasło i wylogowuje wszystkie sesje tego konta.
