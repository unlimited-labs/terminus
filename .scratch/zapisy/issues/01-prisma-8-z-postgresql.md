# Prisma 8 z PostgreSQL

Type: research
Status: resolved

## Question

Jaki jest aktualny stan Prisma 8 (wydanie niestabilne) i jak jej użyć w tym
projekcie? Konkretnie: jak wygląda konfiguracja z PostgreSQL (generator,
driver adapter, plik konfiguracyjny), co zmieniło się względem Prisma 7, jak
uruchamiać migracje w kontenerze Docker przy starcie, jak robić transakcje
z blokadą wiersza lub poziomem izolacji (potrzebne do losowania slotu bez
przepełnienia), oraz czy adapter Prisma w Better Auth działa z Prisma 8.
Znane błędy i obejścia.

## Answer

Pełne wyniki ze źródłami: [research/prisma-8.md](../research/prisma-8.md). Nic nie było instalowane ani uruchamiane.

Potwierdzone w dokumentacji:

- Prisma 8 to przepisanie od zera (dawne "Prisma Next"), nie rozwinięcie wersji 7. Nie ma `@prisma/client`, `PrismaClient`, bloku `generator`, `prisma generate`, driver adapterów, `schema.prisma` ani `migrate dev/deploy`.
- Stan: CLI `prisma@8.0.0-rc.19` (2026-09-29), biblioteka `@prisma/orm-postgres@8.0.0-rc.13`. Wydanie stabilne zapowiedziane na październik 2026; między RC zdarzają się zmiany łamiące.
- Wymagania: Node 24, TypeScript 5.9+, PostgreSQL 15+, tylko ESM.
- Konfiguracja: `prisma.config.ts`, schemat w `src/prisma/contract.prisma`, `prisma contract emit` generuje `contract.json` i `contract.d.ts` (commitowane), klient w ręcznie utrzymywanym `src/prisma/db.ts`. Jest szablon `pnpm create prisma@latest <app> --template tanstack-start --provider postgres`.
- Migracje w Dockerze: `prisma db migrate` przed startem serwera; obraz musi zawierać CLI (devDependencies), config, kontrakt i katalog `migrations/`. Udokumentowany koszt: obraz około 2,1 GB.
- Transakcje: `db.transaction(fn)` bez opcji, poziom READ COMMITTED. Brak natywnego `FOR UPDATE`, poziomu izolacji i atomowego `increment`; zostaje surowy SQL przez `tx.query` / `tx.execute`. Ponawianie ręczne po `error.sqlState`. Macierz funkcji Prisma oznacza surowy SQL na Postgres jako nietestowany.
- Adapter Prisma w Better Auth (`@better-auth/prisma-adapter@1.7.6`) obsługuje Prisma 5–7. Issue #9636 "Support Prisma ORM 8" otwarte; PR #10099 zamknięty bez scalenia 2026-09-14. Better Auth działa bezpośrednio na puli `pg` i sam tworzy swoje tabele (`npx auth@latest migrate`).

Wnioski niepotwierdzone:

- Przy Prisma 8: Better Auth na `pg`, Prisma tylko dla tabel domenowych — dwa narzędzia migracji na jednej bazie.
- Losowanie: warunkowy `UPDATE ... WHERE zajete < pojemnosc` + ograniczenie unikalności, z testem współbieżności jako pierwszym krokiem budowy.
- Osobna usługa `migrate` w compose albo jeden duży obraz.

Skutek dla mapy: wybór wersji Prisma przestaje być oczywisty — nowe zadanie "Prisma 8 czy Prisma 7".
