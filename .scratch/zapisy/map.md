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
- Rozmowa i interfejs po polsku; kod (modele, pola, zmienne, funkcje) po
  angielsku — mapowanie nazw w `SPEC.md`.

## Decisions so far

<!-- jedna linia na zamknięte zadanie -->

- [TanStack Start z Better Auth](issues/02-tanstack-start-z-better-auth.md) — integracja jest udokumentowana; rejestracja wyłączana opcją, konta i hasła przez plugin `admin`; limit prób dla strony studenta wymaga osobnej biblioteki; serwer Node przez Nitro (beta).
- [Prisma 8 z PostgreSQL](issues/01-prisma-8-z-postgresql.md) — Prisma 8 to przepisanie od zera (RC, stabilna w październiku 2026); adapter Better Auth jej nie obsługuje; blokady i poziomy izolacji tylko surowym SQL.
- [Prisma 8 czy Prisma 7](issues/15-prisma-8-czy-prisma-7.md) — Prisma 7 dla całej bazy, z adapterem Better Auth; przejście na 8 dopiero po wydaniu stabilnym i wsparciu w Better Auth.
- [Zapis grupowy](issues/04-zapis-grupowy.md) — slot mieści jeden zespół (1 do maks. osób, ustawiane per zaliczenie); zapis to indeks + imię i nazwisko; błędny indeks odrzuca cały zapis; harmonogram z nazwiskami jest publiczny dla posiadaczy linku.
- [Biblioteka przeciągnij-i-upuść](issues/03-biblioteka-przeciagnij-i-upusc.md) — `@dnd-kit/react` (0.x, przypięta wersja); zamiana kafelków i limit pojemności to własny kod w `onDragEnd`; shadcn/ui działa z TanStack Start.
- [Generowanie slotów z okien](issues/05-generowanie-slotow-z-okien.md) — sloty to rekordy tworzone przy zapisaniu okna, okno nie zostaje w bazie; reszta z dzielenia przepada; bez przerw i bez nachodzenia; długość slotu w zaliczeniu to tylko wartość domyślna; usuwanie wolnych slotów pojedynczo lub całym dniem.
- [Algorytm losowania](issues/06-algorytm-losowania.md) — zapisy na jedno zaliczenie idą po kolei pod blokadą wiersza zaliczenia; losowane tylko sloty, które się nie zaczęły; indeks z zapisem → odrzucenie z podaniem jego slotu; `crypto.randomInt`, bez audytu.
- [Konta prowadzących](issues/07-konta-prowadzacych.md) — pierwszy superadmin z env tworzony tylko gdy go nie ma; konta zakłada superadmin, bez wymuszonej zmiany hasła; kont się nie usuwa, tylko blokuje; superadmin nie widzi cudzych zaliczeń; awaryjny reset hasła poleceniem w kontenerze.
- [Ochrona strony studenta](issues/08-ochrona-strony-studenta.md) — limit tylko nieudanych prób "nie ma na liście" na IP; trzy różne komunikaty; bez CAPTCHA; `noindex`; klauzula RODO oparta na AGH, do akceptacji IOD.
- [Strona studenta](issues/09-strona-studenta.md) — harmonogram jako plansza (dni = kolumny, przewijana w poziomie, kafelek rozwija pełny skład), formularz w panelu wysuwanym z dołu; wynik jako "bilet" z numerami indeksów; RODO zwinięte; minione sloty wyglądają zwyczajnie.
- [Tablica zapisów prowadzącego](issues/10-tablica-zapisow-prowadzacego.md) — tabela slotów z panelem "Niezapisani" z lewej; tylko przeciąganie (osoba: przeniesienie, zamiana, usunięcie; zespół: przeniesienie albo zamiana); "Cofnij" zamiast potwierdzeń; klawiatura z dnd-kit.
- [Grupy zajęciowe i import CSV](issues/16-grupy-zajeciowe-i-import-csv.md) — zaliczenie ma jedną lub kilka list indeksów (import CSV z uczelni, z nazwiskami); slot należy do listy, indeks losuje tylko ze slotów swojej listy; student wpisuje sam indeks; zmienia losowanie, stronę studenta i tablicę.
- [Wdrożenie na VPS](issues/11-wdrozenie-na-vps.md) — compose tylko z aplikacją za istniejącym NPMplus, osobna baza `zapisy` we wspólnym kontenerze PostgreSQL, obraz budowany lokalnie do `registry:2`, migracje i superadmin przy starcie, bez kopii zapasowych.
- [Schemat bazy danych](issues/12-schemat-bazy-danych.md) — kod po angielsku (`Exam`, `Roster`, `RosterEntry`, `Slot`, `Enrollment`); `timestamptz` + `@date-fns/tz`; złożone klucze obce z `examId`; baza pilnuje unikalności i blokad usunięcia, kod pod blokadą — pojemności i nienachodzenia slotów.
- [Architektura i układ plików](issues/13-architektura-i-uklad-plikow.md) — `routes/` cienkie, `domain/` czysta logika, `server/` baza pod blokadą; middleware + `getOwnedExam`; TanStack Query z pełnym stanem tablicy; operacje jako polecenia z "Cofnij"; osobna baza `zapisy` zamiast schematu; wersje przypięte (Prisma 7!).

## Not yet specified

- Zmiana maksymalnej wielkości zespołu po rozpoczęciu zapisów (co gdy istnieje
  już większy zespół). Zmianę długości slotu i usuwanie slotów rozstrzygnęło
  zadanie o generowaniu slotów.
- Szczegóły "duplikuj zaliczenie" (czy kopiuje listy indeksów) i formatu
  eksportu CSV.
- Kierunek wizualny całości — wyjdzie z prototypów.
- Końcowe złożenie `SPEC.md` i lista bibliotek z potwierdzonymi wersjami.

## Out of scope

- Budowa aplikacji — mapa kończy się na specyfikacji.
- Konta studentów, e-maile, powiadomienia, lista rezerwowa, zamiana slotów
  przez studentów, osobna encja "przedmiot", daty otwarcia/zamknięcia zapisów.
