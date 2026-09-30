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
- **Superadmin** — prowadzący, który dodatkowo zarządza kontami prowadzących
  (plugin `admin` z Better Auth). Nie widzi cudzych zaliczeń.
  - Pierwszy superadmin: przy każdym starcie kontenera skrypt czyta
    `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` i tworzy konto tylko wtedy,
    gdy tego e-maila nie ma w bazie; istniejącego konta nie rusza.
  - Zakłada konto (e-mail, imię i nazwisko, hasło przekazywane poza aplikacją,
    bez wymuszonej zmiany), zmienia e-mail i nazwisko, ustawia nowe hasło
    (wylogowuje wszystkie sesje tej osoby), blokuje i odblokowuje konto,
    nadaje i odbiera uprawnienie superadmina. Nie może odebrać go sobie ani
    zablokować siebie.
  - Usuwania kont nie ma. Zablokowany prowadzący nie zaloguje się, jego
    zaliczenia i linki działają dalej. Przepisywania zaliczeń na inne konto
    nie ma.
  - Utrata hasła bez innego superadmina: polecenie w kontenerze
    `pnpm reset-password <email>`.
- Każdy prowadzący zmienia własne hasło na stronie konta, podając obecne.
  E-mail służy tylko do logowania; nie jest weryfikowany.
- **Student** — bez konta; identyfikuje się samym numerem indeksu.

Rejestracja publiczna jest wyłączona — inaczej każdy student mógłby założyć
sobie konto prowadzącego.

## Model danych

- **Zaliczenie** — właściciel (prowadzący), nazwa, opis/miejsce, UUID do linku,
  domyślna długość slotu, maksymalna wielkość zespołu (1 = zaliczenie
  indywidualne). Przedmiot to część nazwy, bez osobnej encji.
- **Slot** — należy do zaliczenia; data, godzina od, godzina do. Mieści
  dokładnie jeden zespół. Osobny rekord w bazie; sloty jednego zaliczenia nie
  nachodzą na siebie.
- **Okno** — nie jest zapisywane; służy tylko do jednorazowego wygenerowania
  slotów.
- **Zespół** — zapisy w tym samym slocie; nie jest osobną encją.
- **Dozwolony indeks** — para (zaliczenie, indeks).
- **Zapis** — (zaliczenie, indeks, imię i nazwisko, slot, czas zapisu). Unikalny na parę
  (zaliczenie, indeks) — ten sam indeks może wystąpić w wielu zaliczeniach.
- Tabele użytkowników i sesji — generowane przez Better Auth.

## Wymagania — student

1. Wchodzi na unikalny link zaliczenia (`/z/<uuid>`). Nie ma publicznej listy zaliczeń.
2. Podaje numer indeksu (same cyfry, dowolna długość) oraz imię i nazwisko.
   Jeśli zaliczenie dopuszcza zespoły, może podać od 1 osoby do maksimum —
   komplet danych dla każdej.
3. Którykolwiek indeks spoza listy albo już zapisany → cały zapis odrzucony,
   nic się nie zapisuje, komunikat wskazuje problematyczny indeks.
4. Indeks jest na liście i nie ma zapisu → aplikacja losuje slot i pokazuje go.
5. Indeks ma już zapis → cały zapis odrzucony jak w punkcie 3, a komunikat
   podaje dzień i godzinę slotu tego indeksu; nigdy nie losuje ponownie.
6. Brak wolnych miejsc → komunikat, bez zapisu.
7. Student nie może zmienić ani usunąć zapisu.
8. Zapisy są otwarte od utworzenia zaliczenia do wyczerpania miejsc; brak dat
   otwarcia/zamknięcia.

9. Harmonogram: każdy, kto ma link, widzi wszystkie sloty (także wolne)
   z imionami i nazwiskami zapisanych, bez wpisywania indeksu. Numery indeksów
   nie są pokazywane.
10. Spóźniony członek zespołu losuje osobny slot; do istniejącego zespołu
    dopisuje go tylko prowadzący.
11. Zamianę slotów student załatwia z prowadzącym poza aplikacją.

12. Ochrona: limit 10 nieudanych prób "indeksu nie ma na liście" na 10 minut
    z jednego IP (`rate-limiter-flexible`, w pamięci; IP z nagłówka reverse
    proxy). Udane zapisy i "indeks ma już zapis" nie liczą się do limitu. Bez
    CAPTCHA.
13. Trzy różne komunikaty: indeksu nie ma na liście; indeks ma już zapis
    (z dniem i godziną slotu); brak wolnych slotów.
14. Strony `/z/…` mają `noindex` i nie mają podglądu linku z nazwiskami.
15. Pod formularzem stała klauzula informacyjna RODO oparta na klauzuli AGH:
    `docs/klauzula-informacyjna.md` (do akceptacji IOD AGH przed uruchomieniem).
16. Dane nie są usuwane automatycznie; usuwa je prowadzący, kasując zaliczenie.
17. Układ strony, najpierw pod telefon: harmonogram jako plansza — dni to
    kolumny o stałej szerokości (przewijanie w poziomie, na starcie pierwszy
    dzień z wolnym slotem), sloty to kafelki z godziną i nazwiskiem pierwszej
    osoby "+n"; dotknięcie zajętego kafelka rozwija pełny skład. Formularz
    w panelu wysuwanym z dołu po "Zapisz się" ("Dodaj osobę do zespołu" do
    maksimum, jeden "Losuj slot", zwinięta klauzula RODO). Wynik w panelu:
    dzień, godzina, miejsce, skład zespołu z numerami indeksów; potem
    "Pokaż na planszy" wyróżnia kafelek. Minione sloty wyglądają jak
    pozostałe, ale pusty miniony slot nie jest opisany jako "wolny".
    Szczegóły i prototyp (wariant B): `.scratch/zapisy/issues/09-strona-studenta.md`.

Świadomie przyjęte ryzyko: kto zna cudzy indeks, może tę osobę zapisać pod
dowolnym nazwiskiem; nazwiska w harmonogramie widzi każdy posiadacz linku.

## Wymagania — losowanie

- Najpierw losowany jest dzień (każdy dzień z wolnym miejscem ma tę samą
  szansę), potem slot w tym dniu (każdy wolny slot z tą samą szansą).
- Losowane są tylko sloty, które jeszcze się nie zaczęły. Dzień z samymi
  minionymi wolnymi slotami nie bierze udziału.
- Slot jest wolny albo zajęty przez jeden zespół, więc wielkość zespołu nie
  wpływa na losowanie; niepełny zespół też zajmuje cały slot.
- Współbieżność: transakcja zapisu zaczyna się od zablokowania wiersza
  zaliczenia (`SELECT … FOR UPDATE`, izolacja `READ COMMITTED`), więc zapisy na
  jedno zaliczenie wykonują się po kolei; losowanie i wstawienie zapisów dzieją
  się pod blokadą. Operacje prowadzącego na tablicy biorą tę samą blokadę.
  Ograniczenie unikalności (zaliczenie, indeks) w bazie jako ostatnia zapora.
  Bez ponawiania.
- Brak wolnych slotów w chwili, gdy zapis dostaje blokadę → komunikat, bez
  zapisu.
- Losowość: `crypto.randomInt`, bez ziarna; wynik nie jest odtwarzalny. Zapis
  z losowania nie jest odróżniany od ręcznego.

## Wymagania — prowadzący

1. Logowanie e-mailem i hasłem.
2. Lista własnych zaliczeń; tworzenie, edycja, usuwanie.
3. Lista indeksów: wklejany tekst, jeden indeks w linii; duplikaty i puste linie
   ignorowane, linie niebędące cyframi zgłaszane jako błąd.
4. Sloty: prowadzący podaje datę i okno czasu (np. 9:00–12:00); aplikacja tnie
   okno na sloty i zapisuje je jako osobne rekordy. Okno nie zostaje w bazie.
   - Jedno wysłanie formularza to jedna data i jedno okno; po zapisaniu
     formularz zostaje otwarty z tymi samymi godzinami.
   - Długość slotu: liczba całkowita minut, 1–480. Wartość w zaliczeniu jest
     domyślna dla formularza okna; jej zmiana nie rusza istniejących slotów,
     więc zaliczenie może mieć sloty różnej długości.
   - Okno mieści się w jednym dniu, "do" późniejsze niż "od". Daty z przeszłości
     dozwolone.
   - Reszta z dzielenia przepada (9:00–12:00 po 25 min → 7 slotów do 11:55).
     Okno krótsze niż jeden slot jest odrzucane.
   - Formularz pokazuje podgląd na żywo: liczbę slotów, ich godziny
     i niewykorzystane minuty.
   - Bez ustawienia przerw między slotami; przerwę robi się dwoma oknami albo
     usunięciem slotu.
   - Okno kolidujące z choć jednym istniejącym slotem tego dnia jest odrzucane
     w całości, z komunikatem wskazującym slot. Stykanie się jest dozwolone.
   - Slot bez zapisów można usunąć pojedynczo; przy każdym dniu jest przycisk
     "usuń wolne sloty" (sloty z zapisami zostają, komunikat mówi, ile pominięto).
   - Maksymalna wielkość zespołu ustawiana per zaliczenie; slot mieści jeden
     zespół.
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
   - przeciągnięcie całego zespołu → przeniesienie do wolnego slotu albo
     zamiana dwóch zespołów;
   - "pełny slot" oznacza zespół o maksymalnej wielkości.
   Ręczny zapis wymaga kompletu: indeks + imię i nazwisko. Prowadzący może
   edytować imię i nazwisko w każdym zapisie.
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
| Baza / ORM | Prisma 7 + PostgreSQL (dlaczego nie 8: `docs/adr/0001-prisma-7-zamiast-8.md`) |
| Autoryzacja | Better Auth + adapter Prisma + plugin `admin` |
| Walidacja | Zod |
| Formularze | TanStack Form |
| Dane po stronie klienta | TanStack Query |
| Komponenty UI | shadcn/ui w wariancie Base UI + Tailwind CSS v4 |
| Przeciągnij-i-upuść | `@dnd-kit/react` (0.x, wersja przypięta) |
| Daty | date-fns; pola natywne `<input type="date">` / `type="time"` |
| CSV | papaparse |
| Config | env walidowany przez t3-env |
| Wdrożenie | Docker + docker compose na własnym VPS |

- Każdy formularz jest zbudowany na TanStack Form i walidowany schematem Zod;
  ten sam schemat waliduje dane po stronie serwera. Bez wyjątków dla "małych"
  formularzy.
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
