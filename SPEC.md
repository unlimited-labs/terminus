# Zapisy na zaliczenia — wymagania

Status: szkic po pierwszej rundzie ustaleń. Punkty oznaczone **[?]** czekają na decyzję.

## Cel

Prowadzący definiuje zaliczenie (lista indeksów, terminy, sloty). Student podaje
numer indeksu i dostaje wylosowany slot. Slot jest niezmienny dla studenta.
Prowadzący widzi listę zapisanych i może ją korygować. Aplikacja obsługuje wiele
przedmiotów i zaliczeń, wielu prowadzących.

## Role

- **Prowadzący** — własne konto (Better Auth, e-mail + hasło). Widzi i edytuje
  tylko swoje zaliczenia.
- **Superadmin** — prowadzący z uprawnieniem do zakładania kont innym
  prowadzącym (plugin `admin` z Better Auth). Pierwszy superadmin tworzony
  z danych w env przy starcie.
- **Student** — bez konta; identyfikuje się samym numerem indeksu.

Rejestracja publiczna jest wyłączona — inaczej każdy student mógłby założyć
sobie konto prowadzącego.

## Model danych

- **Zaliczenie** — właściciel (prowadzący), nazwa, opis/miejsce, UUID do linku.
  Przedmiot to część nazwy, bez osobnej encji.
- **Slot** — należy do zaliczenia; data, godzina od, godzina do, pojemność.
- **Dozwolony indeks** — para (zaliczenie, indeks).
- **Zapis** — (zaliczenie, indeks, slot, czas zapisu). Unikalny na parę
  (zaliczenie, indeks) — ten sam indeks może wystąpić w wielu zaliczeniach.
- Tabele użytkowników i sesji — generowane przez Better Auth.

## Wymagania — student

1. Wchodzi na unikalny link zaliczenia (`/z/<uuid>`). Nie ma publicznej listy zaliczeń.
2. Podaje numer indeksu (same cyfry, dowolna długość).
3. Indeksu nie ma na liście → komunikat, bez zapisu.
4. Indeks jest na liście i nie ma zapisu → aplikacja losuje slot i pokazuje go.
5. Indeks ma już zapis → aplikacja pokazuje ten sam slot, nigdy nie losuje ponownie.
6. Brak wolnych miejsc → komunikat, bez zapisu.
7. Student nie może zmienić ani usunąć zapisu.
8. Zapisy są otwarte od utworzenia zaliczenia do wyczerpania miejsc; brak dat
   otwarcia/zamknięcia.

Świadomie przyjęte ryzyko: kto zna cudzy indeks, może tę osobę zapisać
i zobaczyć jej slot.

## Wymagania — losowanie

- Najpierw losowany jest dzień (każdy dzień z wolnym miejscem ma tę samą
  szansę), potem slot w tym dniu (każdy wolny slot z tą samą szansą).
- **[?]** Dokładny algorytm przy zapisie grupowym — patrz mapa.
- Sprawdzenie pojemności i zapis w jednej transakcji bazy + ograniczenie
  unikalności (zaliczenie, indeks), żeby dwa jednoczesne wejścia nie przepełniły
  slotu ani nie dały dwóch zapisów.

## Wymagania — prowadzący

1. Logowanie e-mailem i hasłem.
2. Lista własnych zaliczeń; tworzenie, edycja, usuwanie.
3. Lista indeksów: wklejany tekst, jeden indeks w linii; duplikaty i puste linie
   ignorowane, linie niebędące cyframi zgłaszane jako błąd.
4. Sloty: prowadzący podaje daty i dla każdej daty okna czasu (np. 9:00–12:00);
   aplikacja tnie okno na sloty o długości ustawionej per zaliczenie.
   - Slot mieści kilka osób; pojemność ustawiana per zaliczenie.
   - Student może przy zapisie podać kilka indeksów naraz (zapis grupowy),
     konfigurowalne per zaliczenie. **[?]** Reguły — patrz mapa.
   - Poprawka to nowe zaliczenie; przycisk "duplikuj zaliczenie" kopiuje nazwę
     i ustawienia.
5. Przed udostępnieniem linku widać: liczba indeksów vs. łączna liczba miejsc,
   z ostrzeżeniem gdy miejsc jest mniej.
6. Link do zaliczenia z przyciskiem "kopiuj".
7. Widok zapisów: tablica slotów pogrupowana po dniach, w slotach kafelki
   z indeksami; osobna kolumna "niezapisani"; liczba wolnych miejsc.
8. Korekty metodą przeciągnij-i-upuść:
   - upuszczenie na slot z wolnym miejscem → przeniesienie;
   - upuszczenie na innego studenta → zamiana slotów;
   - upuszczenie "niezapisanego" na slot → ręczny zapis;
   - upuszczenie na kolumnę "niezapisani" → usunięcie zapisu (student może losować od nowa);
   - upuszczenie na pełny slot (nie na osobę) → odrzucone.
   Operacje dostępne też z klawiatury.
9. Eksport listy do CSV.
10. Edycja po starcie zapisów: dodawanie indeksów i slotów dozwolone; usunięcie
    slotu lub indeksu z istniejącym zapisem zablokowane, dopóki zapis nie
    zostanie przeniesiony lub usunięty.

## Stos techniczny

Zasada: gotowe biblioteki zamiast własnego kodu, gdzie tylko się da.

| Obszar | Wybór |
|---|---|
| Framework | TanStack Start (Router + server functions) |
| Pakiety | pnpm |
| Baza / ORM | Prisma 8 (niestabilna — świadoma decyzja) + PostgreSQL |
| Autoryzacja | Better Auth + adapter Prisma + plugin `admin` |
| Walidacja | Zod |
| Formularze | TanStack Form |
| Dane po stronie klienta | TanStack Query |
| Komponenty UI | shadcn/ui + Tailwind CSS |
| Przeciągnij-i-upuść | dnd-kit |
| Daty | date-fns; pola natywne `<input type="date">` / `type="time"` |
| CSV | papaparse |
| Config | env walidowany przez t3-env |
| Wdrożenie | Docker + docker compose na własnym VPS |

- Projekt wizualny: skill `frontend-design` przy budowie UI.
- Interfejs po polsku.
- Silnik bazy: PostgreSQL jako drugi kontener w compose.

## Świadomie pominięte

- Konta studentów, e-maile, powiadomienia, przypomnienia.
- Zamiana slotów przez samych studentów.
- Lista rezerwowa.
- Osobna encja "przedmiot".
- Daty otwarcia/zamknięcia zapisów.
- Reset hasła mailem (hasło resetuje superadmin).

## Otwarte pytania

Prowadzone jako zadania na mapie: `.scratch/zapisy/map.md`.
