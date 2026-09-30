# Mapa: zapisy na zaliczenia

Label: wayfinder:map

## Destination

Kompletny `SPEC.md` w katalogu głównym: po nim nie zostaje nic do zdecydowania
i budowę aplikacji można zacząć w osobnej sesji. Budowa nie należy do tej mapy.

## Notes

- Domena: aplikacja webowa do losowego przydziału slotów na zaliczenia.
- Decyzje sprzed powstania mapy są zapisane w `SPEC.md`; słownik w `CONTEXT.md`.
  Każde rozstrzygnięte zadanie dopisuje swój wynik do `SPEC.md`.
- Stos narzucony przez użytkownika: TanStack Start, Prisma 7, PostgreSQL,
  Better Auth, pnpm, Docker + docker compose na VPS, config przez env.
- Formularze zawsze przez TanStack Form z walidacją Zod.
- Zasada: gotowe biblioteki zamiast własnego kodu, gdzie tylko się da.
- Skille: `/grilling` i `/domain-modeling` przy zadaniach typu grilling;
  `/frontend-design` i `/prototype` przy prototypach UI.
- Rozmowa i interfejs po polsku.

## Decisions so far

<!-- jedna linia na zamknięte zadanie -->

- [TanStack Start z Better Auth](issues/02-tanstack-start-z-better-auth.md) — integracja jest udokumentowana; rejestracja wyłączana opcją, konta i hasła przez plugin `admin`; limit prób dla strony studenta wymaga osobnej biblioteki; serwer Node przez Nitro (beta).
- [Prisma 8 z PostgreSQL](issues/01-prisma-8-z-postgresql.md) — Prisma 8 to przepisanie od zera (RC, stabilna w październiku 2026); adapter Better Auth jej nie obsługuje; blokady i poziomy izolacji tylko surowym SQL.
- [Prisma 8 czy Prisma 7](issues/15-prisma-8-czy-prisma-7.md) — Prisma 7 dla całej bazy, z adapterem Better Auth; przejście na 8 dopiero po wydaniu stabilnym i wsparciu w Better Auth.
- [Zapis grupowy](issues/04-zapis-grupowy.md) — slot mieści jeden zespół (1 do maks. osób, ustawiane per zaliczenie); zapis to indeks + imię i nazwisko; błędny indeks odrzuca cały zapis; harmonogram z nazwiskami jest publiczny dla posiadaczy linku.
- [Biblioteka przeciągnij-i-upuść](issues/03-biblioteka-przeciagnij-i-upusc.md) — `@dnd-kit/react` (0.x, przypięta wersja); zamiana kafelków i limit pojemności to własny kod w `onDragEnd`; shadcn/ui działa z TanStack Start.
- [Generowanie slotów z okien](issues/05-generowanie-slotow-z-okien.md) — sloty to rekordy tworzone przy zapisaniu okna, okno nie zostaje w bazie; reszta z dzielenia przepada; bez przerw i bez nachodzenia; długość slotu w zaliczeniu to tylko wartość domyślna; usuwanie wolnych slotów pojedynczo lub całym dniem.
- [Algorytm losowania](issues/06-algorytm-losowania.md) — zapisy na jedno zaliczenie idą po kolei pod blokadą wiersza zaliczenia; losowane tylko sloty, które się nie zaczęły; indeks z zapisem → odrzucenie z podaniem jego slotu; `crypto.randomInt`, bez audytu.

## Not yet specified

- Zmiana maksymalnej wielkości zespołu po rozpoczęciu zapisów (co gdy istnieje
  już większy zespół). Zmianę długości slotu i usuwanie slotów rozstrzygnęło
  zadanie o generowaniu slotów.
- Szczegóły "duplikuj zaliczenie" i formatu eksportu CSV.
- Kierunek wizualny całości — wyjdzie z prototypów.
- Końcowe złożenie `SPEC.md` i lista bibliotek z potwierdzonymi wersjami.

## Out of scope

- Budowa aplikacji — mapa kończy się na specyfikacji.
- Konta studentów, e-maile, powiadomienia, lista rezerwowa, zamiana slotów
  przez studentów, osobna encja "przedmiot", daty otwarcia/zamknięcia zapisów.
