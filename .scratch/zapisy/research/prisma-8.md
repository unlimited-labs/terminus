# Prisma 8 z PostgreSQL — wyniki researchu

Stan na 2026-09-30. Ticket: `.scratch/zapisy/issues/01-prisma-8-z-postgresql.md`.

Oznaczenia: **[P]** potwierdzone w źródle pierwotnym (link obok), **[W]** wniosek własny, niepotwierdzony wprost. Nic nie było instalowane ani uruchamiane — żaden fragment kodu poniżej nie został wykonany.

## Najważniejsze (czytać najpierw)

1. **Prisma 8 to nie "Prisma 7 + zmiany", tylko przepisany od zera ORM (dawniej "Prisma Next").** Nie ma `@prisma/client`, `PrismaClient`, bloku `generator`, `prisma generate`, driver adapterów, `schema.prisma`, `migrate dev/deploy`. Pytanie 2 z ticketu (generator, driver adapter) jest więc bezprzedmiotowe — patrz sekcja 2.
2. **Adapter Prisma w Better Auth nie działa z Prisma 8 i nie ma zamiennika.** Better Auth trzeba podłączyć bezpośrednio przez `pg` (sekcja 5). To unieważnia założenie `prismaAdapter(...)` z `research/tanstack-start-better-auth.md` (wiersze 31–34) oraz wzmianki o `prisma generate` / `prisma migrate deploy` tamże (wiersze 52, 71).
3. **Transakcje: brak `isolationLevel`, brak natywnego `FOR UPDATE`, brak atomowego `increment`.** Da się to zrobić surowym SQL-em wewnątrz `db.transaction` (sekcja 4).
4. Status: release candidate, GA zapowiedziane na październik 2026; między RC są zmiany łamiące.

## 1. Co jest wydane

- **[P]** Dwa pakiety o osobnej numeracji: CLI `prisma` `latest` = `8.0.0-rc.19` (2026-09-29) i biblioteka `@prisma/orm-postgres` `latest` = `8.0.0-rc.13` (2026-09-28). "Install both at `latest`; any two `latest` versions work together". — <https://www.prisma.io/docs/orm/release-status>, <https://registry.npmjs.org/prisma>, <https://registry.npmjs.org/@prisma/orm-postgres>
- **[P]** Uwaga: `latest` pakietu `prisma` wskazuje na RC, więc `pnpm add prisma` instaluje Prisma 8. Tag `prev` = `7.10.0`, tag `next` = `8.0.0-rc.10` (przestarzały — nie używać). — <https://registry.npmjs.org/prisma>
- **[P]** `@prisma/client` i `@prisma/adapter-pg` zostają na `7.10.0` i nie są częścią Prisma 8. — <https://www.prisma.io/docs/orm/release-status>
- **[P]** RC od 2026-08-17 (`8.0.0-rc.3`), kolejne wydania co kilka dni. GA: "expected in October 2026". Prisma 7 wspierana 18 miesięcy po GA. — <https://registry.npmjs.org/prisma>, <https://www.prisma.io/docs/orm/release-status>
- **[P]** Repozytorium: `prisma/orm` (ORM) i `prisma/prisma-cli` (CLI); Prisma 7 na gałęzi `v7`. — <https://github.com/prisma/orm>
- **[P]** Wymagania: Node 24 (README i "Supported Versions"; strona release-status podaje 22.18+, przewodnik TanStack: "on the 24 line, 24.11 or newer"), TypeScript ≥ 5.9, PostgreSQL ≥ 15, tylko ESM (`"type": "module"`), `moduleResolution: "bundler"`. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/docs/Supported%20Versions.md>, <https://www.prisma.io/docs/guides/frameworks/tanstack-start>
- **[W]** Przypiąć Node ≥ 24.11 w obrazie i dokładne wersje obu pakietów w `package.json` (bez `^`).

Instalacja (**[P]**, <https://www.prisma.io/docs/orm/release-status>):

```bash
pnpm add --save-dev prisma
pnpm add @prisma/orm-postgres
```

Albo scaffolding: `pnpm dlx prisma@latest orm init --yes --target postgres --authoring psl` (istniejący projekt) lub `pnpm create prisma@latest my-app --template tanstack-start --provider postgres --no-deploy` (nowy projekt TanStack Start). — <https://www.prisma.io/docs/guides/deployment/docker>, <https://www.prisma.io/docs/guides/frameworks/tanstack-start>

### Zmiany względem Prisma 7

Wszystko **[P]** z <https://www.prisma.io/docs/orm/coming-from-prisma-orm-7>:

| Prisma 7 | Prisma 8 |
| --- | --- |
| `schema.prisma` z blokami `generator`/`datasource` | `src/prisma/contract.prisma` (pierwsza linia `// use prisma-8`) + `prisma.config.ts` |
| `prisma generate` → `PrismaClient` | `prisma contract emit` → `contract.json` + `contract.d.ts` (commitować oba) |
| `new PrismaClient({ adapter })` | `src/prisma/db.ts` eksportuje `db` |
| `prisma.user.findMany({ where })` | `db.orm.public.User.where(...).all()` |
| `findUnique` / `findFirst` | `.where(...).first()` (zwraca `null`) |
| `migrate dev` | `db update` albo `migration plan` + `db migrate` |
| `migrate deploy` | `db migrate` |
| `db push` | `db init` (pusta baza), potem `db update` |
| `$transaction(async tx => …)` | `db.transaction(async tx => …)`, zapytania przez `tx.orm` |
| `$queryRaw` / `$executeRaw` | ``db.raw.sql`…`.returnsRow({...})`` / `.affectedCount()` |
| kody `P2002` itd. | `error.code` typu `RUNTIME.*`, błąd bazy w `error.sqlState` (`23505` = naruszenie unikalności) |
| `db seed`, `studio` | brak (seed = własny skrypt; Studio tylko z `prisma@7`) |

Niedostępne: `increment`/`decrement`, opcje transakcji (`isolationLevel`, `timeout`, `maxWait`, zagnieżdżanie), większość nested writes, `$extends`, filtrowanie w JSON, TypedSQL, `findUniqueOrThrow`.

## 2. Konfiguracja z PostgreSQL

Wszystko **[P]** z <https://www.prisma.io/docs/orm/coming-from-prisma-orm-7>, o ile nie zaznaczono inaczej.

- **Generator:** nie istnieje. **Driver adapter:** nie istnieje — `@prisma/orm-postgres` ma `pg@8.22.0` jako własną zależność. — <https://registry.npmjs.org/@prisma/orm-postgres>
- **Plik konfiguracyjny** `prisma.config.ts` w katalogu głównym:

```ts
import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: { connection: process.env.DATABASE_URL! },
  }),
});
```

  Klucze sekcji `orm`: `contract`, `db`, `output` (opcjonalny), `extensions`, `migrations: { dir }`. Brak ustawienia `provider` — bazę wybiera import z `@prisma/orm-postgres/config`.

  **[P]** Rozbieżność źródeł: dokumentacja importuje `definePrismaConfig` z `prisma/config`, skill w repo (rc.13) z `@prisma/cli-engine`. Rozstrzyga plik wygenerowany przez `orm init`; zła koperta kończy się błędem `CONFIG.VERSION_MARKER_MISSING`. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/contract.md>

- **Klient** `src/prisma/db.ts` (nic nie jest generowane do `node_modules` ani do `generated/`):

```ts
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

export const db = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL! });
```

- **[P]** Artefakty `contract.json` i `contract.d.ts` lądują obok pliku kontraktu (`src/prisma/`); migracje w `migrations/app/<timestamp>_<slug>/`, migawki kontraktu w `migrations/snapshots/`. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/quickstart.md>
- **[P]** Klient łączy się leniwie; w serwerze ma być singletonem na poziomie modułu, bez `db.close()` w handlerach. Opcje puli: `poolOptions.connectionTimeoutMillis` / `idleTimeoutMillis`; reszta tylko przez własny `pg.Pool` przekazany jako `pg: pool` (wyklucza się z `url`). — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/runtime.md>
- **[P]** Modele adresuje się zawsze ze schematem: `db.orm.public.Slot`. Model bez `@@map` daje tabelę o nazwie dokładnie jak model (`"Slot"`, z wielkością liter). — <https://github.com/prisma/orm/releases/tag/v8.0.0-rc.12>
- **[P]** Vite (czyli TanStack Start): plugin `prismaVitePlugin()` z `@prisma/orm-postgres/vite-plugin-contract-emit` uruchamia `contract emit` w `vite dev`; wymaga Vite 7 lub 8. Nie działa w `vite build` — tam skrypt `"prebuild": "prisma contract emit"`. — <https://www.prisma.io/docs/cli/contract-emit>, <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/build.md>
- **[P]** Uwaga: pliki w repo `prisma/orm` (skille, README pakietów) używają aliasów `@internal/postgres/*`; opublikowana nazwa to `@prisma/orm-postgres/*`. — <https://registry.npmjs.org/@prisma/orm-postgres>

## 3. Migracje w kontenerze Docker przy starcie

Wszystko **[P]** z oficjalnego przewodnika <https://www.prisma.io/docs/guides/deployment/docker> (napisany dla npm + Express), o ile nie zaznaczono inaczej.

- Polecenie: `prisma db migrate`. Idempotentne ("Already up to date"). Zalecany start: `CMD ["sh", "-c", "npm run db:migrate && npm start"]`.
- W obrazie muszą być: Node 24, `node_modules` **z devDependencies** (CLI `prisma` jest devDependency), `prisma.config.ts`, `src/prisma/contract.json` + `contract.d.ts` (+ `contract.prisma`), cały katalog `migrations/` (w tym `snapshots/` i `app/refs/`). — też <https://www.prisma.io/docs/orm/migrations/applying-a-migration>
- Bez silników natywnych: `node:24-alpine` i `node:24-slim` działają tak samo, nie trzeba `openssl` ani `libc6-compat`.
- `DATABASE_URL` czytany w czasie działania z env (CLI przez `prisma.config.ts`, aplikacja przez `db.ts`).
- compose: `depends_on: { db: { condition: service_healthy } }` + healthcheck `pg_isready`.
- Koszt: obraz ~2,1 GB, "almost all of it the `prisma` dev dependency".
- **[P]** Na PostgreSQL cały przebieg `db migrate` to jedna transakcja (nieudany nie zostawia zmian); dwa równoległe przebiegi — jeden czeka na drugi. — <https://www.prisma.io/docs/orm/migrations/applying-a-migration>
- **[P]** Migracji nie da się zastosować z kodu aplikacji przy starcie ("Runtime-apply migrations … doesn't"); tylko przez CLI. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/migrations.md>
- **[P]** `db update` nigdy na produkcji (nie zostawia historii). Przepływ: lokalnie `contract emit` → `migration plan --name <slug>` → commit → w kontenerze `db migrate`. — tamże
- **[P]** `docker run --env-file` nie zdejmuje cudzysłowów z `DATABASE_URL` (compose zdejmuje) — CLI odrzuci taki URL.

**[W]** Adaptacja do pnpm + TanStack Start (Nitro, `.output`):

- Nie przycinać zależności (`pnpm install --prod`, `pnpm deploy --prod`) w obrazie, który uruchamia migracje — zniknie CLI.
- `.output` z Nitro nie zawiera CLI ani `migrations/`. Dwie opcje: (a) jeden obraz z pełnym `node_modules` i źródłami, `CMD sh -c "pnpm prisma db migrate && node .output/server/index.mjs"` — najprostsze, obraz ~2 GB; (b) osobna usługa `migrate` w compose z obrazu etapu build, a aplikacja z `depends_on: { migrate: { condition: service_completed_successfully } }` i odchudzonym obrazem runtime. Dla jednego VPS wystarczy (a).
- `contract.json` jest importowany w `db.ts`, więc bundler powinien wciągnąć go do `.output` — sprawdzić przy pierwszym buildzie.
- Seed pierwszego admina (z drugiego researchu) uruchamiać po `db migrate`, a przed startem serwera.

## 4. Transakcje dla "wybierz wolny slot i wstaw zapis"

Potwierdzone:

- **[P]** `db.transaction(async (tx) => …)`: commit po zwróceniu wartości, rollback po wyjątku; `tx.orm`, `tx.sql`, `tx.query(plan)`, `tx.execute(plan)`. Funkcja nie przyjmuje żadnych opcji. — <https://www.prisma.io/docs/orm/fundamentals/transactions>
- **[P]** Poziom izolacji: zawsze domyślny bazy (`READ COMMITTED`). Inny ustawia się ręcznie jako pierwszą instrukcję: ``await tx.execute(db.raw.sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.affectedCount().build())``. — tamże
- **[P]** Surowy SQL w transakcji: "`tx.query(...)` and `tx.execute(...)` take the same built queries as `runtime.query(...)` and `runtime.execute(...)` do". — <https://www.prisma.io/docs/orm/reference/raw-queries>
- **[P]** Ponowienia: Prisma nie ponawia sama. Kod PostgreSQL jest w `error.sqlState` (`40001` serializacja, `40P01` deadlock); konflikt przy commicie przychodzi jako `RUNTIME.TRANSACTION_COMMIT_FAILED` z błędem bazy w `error.cause`. Dokumentacja podaje gotową funkcję `withRetry`. Nie ma klasy błędu do `instanceof`. — <https://www.prisma.io/docs/orm/fundamentals/transactions>
- **[P]** Brak timeoutu transakcji (ustawić `idle_in_transaction_session_timeout` w PostgreSQL); `db.transaction` wywołane wewnątrz callbacka to osobna transakcja, nie zagnieżdżona. — tamże
- **[P]** Naruszenie unikalności: `error.sqlState === "23505"`. — <https://www.prisma.io/docs/orm/coming-from-prisma-orm-7>
- **[P]** Brak natywnego `FOR UPDATE` / blokad w ORM i w SQL builderze (nie ma ich w macierzy funkcji); brak `increment`. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/scorecard/14-transactions.md>, <https://github.com/prisma/orm/blob/v8.0.0-rc.13/scorecard/12-nested-writes-and-atomic-ops.md>

Zastrzeżenie:

- **[P]** Surowy tag `client.raw` ma w macierzy funkcji status 🟡 "Untested" na Postgresie (brak testu integracyjnego), a komentarz w teście portowanym z Prisma 7 mówi, że `SELECT … FOR UPDATE` w transakcji nie został przeniesiony. Dokumentacja pokazuje jednak dokładnie ten wzorzec. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/scorecard/13-raw-and-typed-sql.md>, <https://github.com/prisma/orm/blob/v8.0.0-rc.13/test/integration/test/ports/prisma/non-ported/functional/interactive-transactions/interactive-transactions.md>
- **[W]** Wniosek: zrobić krótki test współbieżności (np. 50 równoległych zapisów na slot o pojemności 5) na samym początku implementacji, zanim reszta na tym stanie.

Zalecenie (**[W]**, standardowy PostgreSQL, niewykonane):

Wariant A — bez jawnych blokad, domyślny `READ COMMITTED`, licznik na slocie:

```ts
await db.transaction(async (tx) => {
  const { affectedRows } = await tx.execute(
    db.raw.sql`UPDATE "Slot" SET taken = taken + 1 WHERE id = ${slotId} AND taken < capacity`
      .affectedCount().build(),
  );
  if (affectedRows === 0) throw new SlotFull(); // rollback; wylosować inny slot i ponowić
  await tx.orm.public.Signup.create({ slotId, studentId });
});
```

`UPDATE` z warunkiem jest atomowy: drugi współbieżny `UPDATE` czeka na blokadę wiersza i po jej zwolnieniu ponownie sprawdza `WHERE`. — <https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED>

Wariant B — bez licznika: ``tx.query(db.raw.sql`SELECT id, capacity FROM "Slot" WHERE id = ${slotId} FOR UPDATE`.returnsRow({...}).build())``, potem policzyć zapisy i wstawić. — <https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS>

Koszt A: `taken` to kolumna zdenormalizowana — trzeba ją zmniejszać przy usunięciu lub przeniesieniu zapisu i rozjedzie się, jeśli ktoś ominie tę ścieżkę. B tego nie ma, za cenę `count(*)` pod blokadą. Oba warianty idą tą samą, nieprzetestowaną po stronie Prisma ścieżką surowego SQL.

Wariant C — `SERIALIZABLE` + `withRetry`: działa, ale wymaga pętli ponowień i nic tu nie daje ponad A.

Niezależnie od wariantu: unikalny constraint (egzamin + numer albumu) jako ostateczna ochrona przed podwójnym zapisem; obsłużyć `23505`. Losowanie slotu robić poza instrukcją blokującą (wybrać kandydata, spróbować, przy `affectedRows === 0` losować ponownie z pozostałych) — wybór schematu należy do ticketu 12, algorytm do ticketu 06.

## 5. Better Auth a Prisma 8

- **[P]** `@better-auth/prisma-adapter@1.7.6` deklaruje peer `prisma: ^5 || ^6 || ^7` i `@prisma/client: ^5 || ^6 || ^7`. Adapter wymaga `PrismaClient`, którego w Prisma 8 nie ma. — <https://registry.npmjs.org/@better-auth/prisma-adapter>
- **[P]** Issue "Support Prisma ORM 8" otwarte od 2026-05-15: "the whole API surface is new, so the current Prisma adapter will not work with it". — <https://github.com/better-auth/better-auth/issues/9636>
- **[P]** PR z adapterem dla Prisma Next zamknięty bez scalenia 2026-09-14; współpracownik projektu: "I'll close this PR and use it as a reference while working on an implementation based on the stable version". Brak terminu. — <https://github.com/better-auth/better-auth/pull/10099>
- **[P]** Dokumentacja adaptera Better Auth opisuje tylko Prisma 7 (i ≤ 6). Przewodnik Better Auth w dokumentacji Prisma też: "The commands and code on this page target Prisma ORM 7". — <https://better-auth.com/docs/adapters/prisma>, <https://www.prisma.io/docs/guides/authentication/better-auth/nextjs>
- **[P]** Better Auth działa bezpośrednio na `pg`: `database: new Pool({ connectionString })`; tabele tworzy `npx auth@latest migrate`; można je wydzielić do osobnego schematu PostgreSQL przez `schemaName` lub `search_path`. — <https://better-auth.com/docs/adapters/postgresql>

**[W]** Zalecenie: Better Auth na własnym `pg.Pool` (wbudowany Kysely), Prisma 8 tylko dla tabel dziedzinowych.

- Tabele Better Auth nie wchodzą do kontraktu Prisma; zarządza nimi `auth migrate`, uruchamiane w kontenerze po `prisma db migrate`. Najczyściej w osobnym schemacie (np. `auth`), żeby oba narzędzia nie widziały nawzajem swoich tabel.
- **[P]** Prisma toleruje obce tabele: `db verify` domyślnie dopuszcza nadmiarowe obiekty ("DB may have extras"; błąd dopiero z `--strict`). Jeśli tabele auth mają być widoczne w kontrakcie (np. klucz obcy egzamin → użytkownik), jest `@@control(external)`. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/migrations.md>
- Klucz obcy z tabeli dziedzinowej do `user.id` Better Auth: albo kolumna tekstowa bez FK w kontrakcie, albo model `User` z `@@control(external)`. Do rozstrzygnięcia w tickecie 12; zachowanie `@@control` nie było sprawdzane w praktyce.
- Wspólna pula: `postgres<Contract>({ contractJson, pg: pool })` i ten sam `pool` w Better Auth — wykonalne wg typów (`pg ^8` po obu stronach), niesprawdzone. Dwie osobne pule też są w porządku przy tej skali.
- Alternatywa: zostać na Prisma 7 (`prisma@7` + `@prisma/client@7`), gdzie adapter działa. Użytkownik świadomie wybrał 8, więc tylko odnotowuję.

## 6. Znane błędy i pułapki

- **[P]** `orm init` instalował `prisma@next` (rc.10) zamiast `latest`; rc.10 przy `migration plan` bez refa `db` po cichu planuje odtworzenie całej bazy. Issue otwarte. Przewodnik Docker z września pokazuje już `npm add -D prisma@latest`. Po `init` sprawdzić wersję w `package.json`. — <https://github.com/prisma/orm/issues/30253>
- **[P]** `orm init` po cichu nadpisuje `tsconfig.json` (`module: preserve`, `moduleResolution: bundler`); `db.ts` importuje `./contract.d`, co nie działa pod `nodenext`. — <https://github.com/prisma/orm/issues/30358>
- **[P]** Lockfile po `orm init` na Windows/macOS nie ma linuksowych pakietów opcjonalnych (`@emnapi/runtime`) i `npm ci` w obrazie się wywraca; obejście: usunąć `node_modules` i lockfile, zainstalować od nowa. Opisane dla npm. — <https://www.prisma.io/docs/guides/deployment/docker>
- **[W]** Dla pnpm to samo zachowanie nie jest potwierdzone; jeśli `pnpm install --frozen-lockfile` padnie w obrazie, zastosować to samo obejście (projekt powstaje na Windows).
- **[P]** Zmiany łamiące między RC, każda z "upgrade recipe": rc.12 — obowiązkowy nagłówek `// use prisma-8`, `dbgenerated(...)` zastąpione ``sql`…` ``, nazwy tabel dosłownie jak model, `definePrismaConfig` zamiast `defineConfig`, konfiguracje łączone w górę drzewa katalogów; rc.13 — nowe klucze w `contract.json` (po aktualizacji ponownie `contract emit`). — <https://github.com/prisma/orm/releases/tag/v8.0.0-rc.12>, <https://github.com/prisma/orm/releases/tag/v8.0.0-rc.13>
- **[P]** Od rc.12 CLI zbiera wszystkie `prisma.config.ts` od bieżącego katalogu w górę do "repository root, which is the first directory with a `.git` entry" i je łączy; `parent: false` w konfiguracji projektu to wyłącza. — <https://github.com/prisma/orm/releases/tag/v8.0.0-rc.12>
- **[W]** Projekt nie jest dziś repozytorium git, a obraz Dockera zwykle nie ma `.git` — zachowanie bez `.git` nie jest opisane. Ustawić `parent: false` albo sprawdzić.
- **[P]** Skrypt jednorazowy (seed) na Postgresie nie kończy się bez `await db.close()` — pula trzyma pętlę zdarzeń. — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/runtime.md>
- **[P]** CLI zbiera telemetrię domyślnie; wyłączenie: `PRISMA_DISABLE_TELEMETRY=1` lub `DO_NOT_TRACK=1` (ustawić w obrazie). — <https://github.com/prisma/orm/blob/v8.0.0-rc.13/skills/prisma-8/references/quickstart.md>
- **[P]** `@prisma/orm-toolchain@8.0.0-rc.13` ma peer `@prisma/cli-engine` dokładnie `0.6.1`, a `prisma@8.0.0-rc.19` zależy od `0.6.2`. — <https://registry.npmjs.org/@prisma/orm-toolchain>, <https://registry.npmjs.org/prisma/8.0.0-rc.19>
- **[W]** Możliwe ostrzeżenie pnpm o niespełnionym peer; dokumentacja twierdzi, że dowolne dwie wersje `latest` współpracują. Zweryfikować przy instalacji.
- **[P]** Brak Studio i `db seed` w Prisma 8; Studio tylko przez `npx prisma@7 studio --url …` spoza katalogu projektu. — <https://www.prisma.io/docs/orm/coming-from-prisma-orm-7>
- **[P]** Skille dla agentów są dostarczane w pakietach (`npx prisma skills sync` / `npx prisma@latest init`) i opisują zainstalowaną wersję — przy implementacji lepsze źródło niż wiedza modelu o Prisma ≤ 7. — <https://github.com/prisma/orm#readme>

## Ryzyka do odnotowania w specyfikacji

1. RC ze zmianami łamiącymi co kilka dni; GA "w październiku 2026". Przypiąć dokładne wersje, aktualizować świadomie wg upgrade recipe.
2. Better Auth bez adaptera Prisma 8 → dwa narzędzia do migracji w jednej bazie (Prisma dla dziedziny, `auth migrate` dla auth). Ustalić kolejność w starcie kontenera i sposób odwołania do użytkownika z tabel dziedzinowych.
3. Operacja zapisu opiera się na surowym SQL w transakcji — ścieżka udokumentowana, ale bez testu integracyjnego po stronie Prisma. Test współbieżności jako pierwszy krok implementacji.
4. Obraz ~2 GB z powodu CLI potrzebnego do migracji.
