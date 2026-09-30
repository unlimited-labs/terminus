# Złożenie specyfikacji

Type: task
Status: resolved
Blocked by: 17, 18, 19

## Question

Doprowadzić `SPEC.md` do stanu "można budować": jeden spójny dokument bez
sprzeczności i bez odwołań "szczegóły w zadaniu", z przeniesionymi treściami
z zamkniętych zadań; lista bibliotek z dokładnymi, sprawdzonymi w npm
wersjami do przypięcia; kolejność budowy (pierwsze kroki: szablon shadcn,
Prisma 7, test współbieżności). Status "szkic" zdjęty.

## Answer

`SPEC.md` przepisany w jeden dokument (14 sekcji): cel, role i konta, model dziedziny z nazwami w kodzie, strona studenta, losowanie i współbieżność, część prowadzącego (zaliczenia, listy, sloty, tablica, eksport), baza ze szkicem Prisma, architektura, wygląd, stos z wersjami, jakość i testy, wdrożenie, kolejność budowy, świadomie pominięte. Bez odsyłaczy "szczegóły w zadaniu"; zadania zostają jako historia uzasadnień, prototypy jako ilustracja (wiążący jest tekst specyfikacji).

- Wersje sprawdzone w rejestrze npm 2026-09-30 (sekcja 10). Decyzja w ramach zadania: TypeScript 6.0.3 zamiast 7.0.2 (`latest`) — 7 to natywny kompilator bez API w JS, a Prisma 7 i inne narzędzia deklarują tylko `>=5.4`; zmiana na 7, gdy narzędzia potwierdzą zgodność.
- Kolejność budowy (sekcja 13) zaczyna od kroków, które sprawdzają niepotwierdzone założenia: instalator shadcn, fallow i trasy TanStack Start, kod wyjścia react-doctor, `createUser` przy wyłączonej rejestracji, test współbieżności, przeciąganie myszą, wersja PostgreSQL i `X-Real-IP` na VPS, akceptacja RODO przez IOD.
