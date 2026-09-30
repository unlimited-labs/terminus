# Standardy kodu i testy

Type: grilling
Status: resolved
Blocked by: 13

## Question

Jakie narzędzia i reguły pilnują jakości? Linter i formatter (Biome czy
ESLint + Prettier), ustawienia TypeScript (strict), konwencje nazw. Co
testujemy i czym: losowanie i współbieżność zapisów na prawdziwej bazie,
reguły przenoszenia i zamiany, testy end-to-end kluczowych ścieżek (student
się zapisuje, prowadzący przenosi). Czy jest CI i co uruchamia? Haki przed
commitem?

## Answer

- Linter i formatter: Oxc (https://oxc.rs/) — `oxlint` (1.86.0, stabilny; reguły type-aware przez `tsgo`; obsługuje wtyczki ESLint w JS, więc można dołożyć reguły TanStack Query/Router) i `oxfmt` (0.71.0, beta, zgodny z Prettierem, sortuje klasy Tailwind). Wybór użytkownika zamiast Biome. Obie wersje przypięte dokładnie; `oxfmt` w becie — przy problemach zamiana na Prettier bez zmiany reszty.
- Analiza całego repo: fallow (https://github.com/fallow-rs/fallow, 3.31.0 z 2026-09-30, MIT, Rust) — nieużywane pliki, eksporty, typy i zależności, duplikaty, złożoność, zależności cykliczne, granice architektury. Konfiguracja `.fallowrc.json`. Granice pilnują podziału z [Architektura i układ plików](13-architektura-i-uklad-plikow.md): `domain/` nie importuje `server/`, Prismy ani Reacta; tylko `server/` importuje klienta Prisma; `routes/` nie sięga do bazy. Wersja przypięta. Obsługa TanStack Start wynika z deklaracji "100+ framework plugins" — niesprawdzone, zweryfikować przy pierwszym uruchomieniu (punkty wejścia tras).
- TypeScript: `strict` + `noUncheckedIndexedAccess`; bez `exactOptionalPropertyTypes`.
- Nazwy: pliki kebab-case (`board-ops.ts`), trasy wg konwencji TanStack Router; komponenty `PascalCase`, funkcje i zmienne `camelCase`, `UPPER_SNAKE` tylko dla prawdziwych stałych; wszystko po angielsku, polski tylko w UI i `messages.pl.ts`.
- Testy `domain/`: Vitest, pisane przed kodem (TDD): losowanie z podstawionym generatorem, reguły tablicy (przeniesienie, zamiana, pełny slot, cudza lista, polecenie odwrotne), cięcie okna, parsowanie CSV (plik testowy z BOM i `;`, dane wymyślone).
- Testy na bazie: Vitest + Testcontainers (`@testcontainers/postgresql`): blokada zaliczenia i zapis (50 równoległych zapisów na 5 slotów → dokładnie 5 zespołów, bez przepełnienia i podwójnych zapisów), blokady usunięcia (`NoAction`), kaskada przy usunięciu zaliczenia.
- E2E: Playwright, kilka ścieżek: student zapisuje zespół i widzi bilet; indeks z zapisem dostaje swój slot; import CSV; przeniesienie na tablicy klawiaturą i myszą + "Cofnij"; logowanie i blokada konta.
- Bez CI i bez haków git. `pnpm check` (oxlint, oxfmt --check, `tsc`, fallow, testy jednostkowe i bazodanowe); `pnpm release` uruchamia `check` + e2e, potem buduje i wysyła obraz. CI, gdy repo trafi na serwer z runnerem.
- Bez progu pokrycia; wymóg: każda reguła z `domain/` ma test, każda ścieżka zapisu ma test na bazie.

## Comments

- Z zadania [Schemat bazy danych](12-schemat-bazy-danych.md): kod po angielsku (modele, pola, zmienne, funkcje), po polsku tylko interfejs; mapowanie pojęć w `SPEC.md`.
