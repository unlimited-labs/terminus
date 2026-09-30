# Mapa: zapisy na zaliczenia

Label: wayfinder:map

## Destination

Kompletny `SPEC.md` w katalogu głównym: po nim nie zostaje nic do zdecydowania
i budowę aplikacji można zacząć w osobnej sesji. Budowa nie należy do tej mapy.

## Notes

- Domena: aplikacja webowa do losowego przydziału slotów na zaliczenia.
- Decyzje sprzed powstania mapy są zapisane w `SPEC.md`; słownik w `CONTEXT.md`.
  Każde rozstrzygnięte zadanie dopisuje swój wynik do `SPEC.md`.
- Stos narzucony przez użytkownika: TanStack Start, Prisma 8, PostgreSQL,
  Better Auth, pnpm, Docker + docker compose na VPS, config przez env.
- Zasada: gotowe biblioteki zamiast własnego kodu, gdzie tylko się da.
- Skille: `/grilling` i `/domain-modeling` przy zadaniach typu grilling;
  `/frontend-design` i `/prototype` przy prototypach UI.
- Rozmowa i interfejs po polsku.

## Decisions so far

<!-- jedna linia na zamknięte zadanie -->

## Not yet specified

- Reguły edycji zaliczenia po rozpoczęciu zapisów (zmiana długości slotu,
  pojemności, usuwanie okien) — zależy od generowania slotów i zapisu grupowego.
- Szczegóły "duplikuj zaliczenie" i formatu eksportu CSV.
- Kierunek wizualny całości — wyjdzie z prototypów.
- Strategia testów (co testować, czym).
- Końcowe złożenie `SPEC.md` i lista bibliotek z potwierdzonymi wersjami.

## Out of scope

- Budowa aplikacji — mapa kończy się na specyfikacji.
- Konta studentów, e-maile, powiadomienia, lista rezerwowa, zamiana slotów
  przez studentów, osobna encja "przedmiot", daty otwarcia/zamknięcia zapisów.
