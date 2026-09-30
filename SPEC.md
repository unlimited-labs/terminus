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
- **Lista indeksów** — należy do zaliczenia, ma nazwę (np. "g1"). Zaliczenie
  ma jedną lub kilka list; każdy import CSV tworzy osobną listę albo
  uzupełnia istniejącą.
- **Slot** — należy do zaliczenia i do jednej listy indeksów; data, godzina
  od, godzina do. Mieści dokładnie jeden zespół. Osobny rekord w bazie; sloty
  jednego zaliczenia nie nachodzą na siebie (także sloty różnych list).
- **Okno** — nie jest zapisywane; służy tylko do jednorazowego wygenerowania
  slotów.
- **Zespół** — zapisy w tym samym slocie; nie jest osobną encją.
- **Dozwolony indeks** — (lista indeksów, indeks, imię i nazwisko). Indeks jest
  najwyżej na jednej liście w danym zaliczeniu.
- **Zapis** — (zaliczenie, indeks, slot, czas zapisu); imię i nazwisko pochodzi
  z listy indeksów. Unikalny na parę (zaliczenie, indeks) — ten sam indeks
  może wystąpić w wielu zaliczeniach.
- Tabele użytkowników i sesji — generowane przez Better Auth.

Nazwy w kodzie (kod po angielsku, interfejs po polsku): Zaliczenie `Exam`,
Lista indeksów `Roster`, Dozwolony indeks `RosterEntry`, numer indeksu
`studentNumber`, Slot `Slot`, Zapis `Enrollment`, Zespół `team`, Okno
`window`, Losowanie `draw`, Harmonogram `schedule`, Prowadzący `User`
(superadmin = `role: "admin"`).

Schemat Prisma (szkic, klucze, co pilnuje baza, a co kod):
`.scratch/zapisy/issues/12-schemat-bazy-danych.md`. W skrócie: czas slotu
jako `timestamptz`, przeliczany z czasu polskiego przez `@date-fns/tz`; link
zaliczenia = `Exam.id` (UUID v4); `firstName` i `lastName` osobno; numer
indeksu jako tekst; złożone klucze obce z `examId`; usunięcie slotu, wpisu
listy lub listy z zapisem blokuje baza (`NoAction`); pojemność slotu,
nienachodzenie slotów i zespół z jednej listy pilnuje kod pod blokadą
zaliczenia; usunięcie zaliczenia kasuje wszystko kaskadowo (w interfejsie
trzeba wpisać nazwę zaliczenia).

## Wymagania — student

1. Wchodzi na unikalny link zaliczenia (`/z/<uuid>`). Nie ma publicznej listy zaliczeń.
2. Podaje sam numer indeksu (same cyfry, dowolna długość); imię i nazwisko
   aplikacja bierze z listy indeksów. Jeśli zaliczenie dopuszcza zespoły, może
   podać od 1 do maksimum indeksów.
3. Którykolwiek indeks spoza list, już zapisany albo z innej listy niż
   pozostali członkowie zespołu → cały zapis odrzucony, nic się nie zapisuje,
   komunikat wskazuje problematyczny indeks.
4. Indeks jest na liście i nie ma zapisu → aplikacja losuje slot spośród
   slotów tej listy i pokazuje go.
5. Indeks ma już zapis → cały zapis odrzucony jak w punkcie 3, a komunikat
   podaje dzień i godzinę slotu tego indeksu; nigdy nie losuje ponownie.
6. Brak wolnych miejsc → komunikat, bez zapisu.
7. Student nie może zmienić ani usunąć zapisu.
8. Zapisy są otwarte od utworzenia zaliczenia do wyczerpania miejsc; brak dat
   otwarcia/zamknięcia.

9. Harmonogram: każdy, kto ma link, widzi wszystkie sloty (także wolne)
   z imionami i nazwiskami zapisanych, bez wpisywania indeksu. Numery indeksów
   nie są pokazywane. Przy więcej niż jednej liście: przełącznik
   "Wszystkie / g1 / g2" nad planszą i nazwa listy na kafelku slotu.
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
    w panelu wysuwanym z dołu po "Zapisz się" (pola na numery indeksów,
    "Dodaj osobę do zespołu" do
    maksimum, jeden "Losuj slot", zwinięta klauzula RODO). Wynik w panelu:
    dzień, godzina, miejsce, skład zespołu z numerami indeksów; potem
    "Pokaż na planszy" wyróżnia kafelek. Minione sloty wyglądają jak
    pozostałe, ale pusty miniony slot nie jest opisany jako "wolny".
    Szczegóły i prototyp (wariant B): `.scratch/zapisy/issues/09-strona-studenta.md`.

Świadomie przyjęte ryzyko: kto zna cudzy indeks, może tę osobę zapisać i zobaczy
jej imię i nazwisko na bilecie; nazwiska w harmonogramie widzi każdy posiadacz
linku.

## Wymagania — losowanie

- Losowanie bierze pod uwagę tylko sloty listy indeksów, na której jest
  zapisywany indeks (cały zespół jest z jednej listy).
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
3. Listy indeksów: import pliku CSV w formacie eksportu uczelni (UTF-8 z BOM,
   separator `;`, pola w cudzysłowach, kolumny `nazwisko`, `imie`, `imie2`,
   `skreslony`, `rezygnacja`, `email`, `indeks`; czyta `papaparse`). Bez
   wklejania tekstu. Do tego ręczne dodanie pojedynczego indeksu z imieniem
   i nazwiskiem.
   - Podgląd przed zapisem: nazwa listy podpowiedziana z nazwy pliku (np.
     "g1", do zmiany), liczba osób, wiersze pominięte i błędne.
   - Imię i nazwisko = `imie` + `nazwisko` (bez drugiego imienia).
   - Pomijane: `skreslony = 1` lub `rezygnacja = 1`. Błędne (nieimportowane):
     indeks nie z samych cyfr, indeks już na innej liście tego zaliczenia.
     Brak kolumny `indeks`, `imie` lub `nazwisko` → cały plik odrzucony.
   - Ponowny import do istniejącej listy: nowe indeksy dopisane, nazwiska
     zaktualizowane; indeksy nieobecne w pliku zostają (wymienione
     w podglądzie); `skreslony = 1` bez zapisu znika z listy, z zapisem zostaje
     i jest oznaczony w podglądzie.
   - Pierwszy import tworzy pierwszą listę; zaliczenie z jedną listą działa
     bez żadnych widocznych "list".
4. Sloty: prowadzący podaje datę i okno czasu (np. 9:00–12:00); aplikacja tnie
   okno na sloty i zapisuje je jako osobne rekordy. Okno nie zostaje w bazie.
   - Jedno wysłanie formularza to jedna data i jedno okno; po zapisaniu
     formularz zostaje otwarty z tymi samymi godzinami.
   - Pole "Lista" (wymagane przy więcej niż jednej liście): wszystkie sloty
     okna należą do wybranej listy. Listę pojedynczego slotu można zmienić.
     Po dodaniu drugiej listy istniejące sloty zostają przy pierwszej.
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
     (z dopiskiem "(kopia)"), opis, ustawienia i — przy zaznaczonym polu
     "Kopiuj listy indeksów" (domyślnie tak) — listy z nazwiskami. Bez slotów
     i zapisów.
5. Przed udostępnieniem linku widać osobno dla każdej listy: liczba indeksów
   vs. liczba miejsc w jej slotach, z ostrzeżeniem gdy miejsc jest mniej.
6. Link do zaliczenia z przyciskiem "kopiuj".
7. Widok zapisów: tabela, wiersz = slot (dzień, godzina, zespół jako kafelki
   z imieniem i nazwiskiem i indeksem), dni oddzielone linią; po lewej
   przyklejony panel "Niezapisani" z wyszukiwarką; nad tabelą liczby
   (zapisani / indeksy, wolne sloty, miejsca) i wyszukiwarka indeksu lub
   nazwiska. Każda korekta kończy się komunikatem z "Cofnij", bez okien
   potwierdzenia. Przy więcej niż jednej liście: kolumna "Lista" przy slocie,
   panel "Niezapisani" podzielony na listy, kafelek osoby w slocie cudzej
   listy z dopiskiem nazwy jej listy; przenoszenie między listami dozwolone
   bez ostrzeżenia. Szczegóły i prototyp (wariant C):
   `.scratch/zapisy/issues/10-tablica-zapisow-prowadzacego.md`.
8. Korekty metodą przeciągnij-i-upuść:
   - upuszczenie na slot z wolnym miejscem → przeniesienie;
   - upuszczenie na innego studenta → zamiana slotów;
   - upuszczenie "niezapisanego" na slot → ręczny zapis;
   - upuszczenie na kolumnę "niezapisani" → usunięcie zapisu (student może losować od nowa);
   - upuszczenie na pełny slot (nie na osobę) → odrzucone.
   - przeciągnięcie całego zespołu → przeniesienie do wolnego slotu albo
     zamiana dwóch zespołów;
   - "pełny slot" oznacza zespół o maksymalnej wielkości.
   Ręczny zapis bierze imię i nazwisko z listy indeksów (bez pytania). Osobę
   spoza list prowadzący najpierw dodaje ręcznie do listy (indeks + imię
   i nazwisko). Edycja imienia i nazwiska na kafelku zmienia wpis na liście.
   Operacje dostępne też z klawiatury.
9. Eksport do CSV (tylko właściciel): kolumny `data`, `od`, `do`, `lista`,
   `indeks`, `nazwisko`, `imie`; wiersz na osobę, sortowanie po slocie
   i nazwisku, niezapisani na końcu bez czasu, wolne sloty pominięte. Format
   jak import: UTF-8 z BOM, `;`, pola w cudzysłowach. Plik
   `<nazwa-zaliczenia>_<RRRR-MM-DD>.csv`.
10. Edycja po starcie zapisów: dodawanie indeksów i slotów dozwolone; usunięcie
    slotu lub indeksu z istniejącym zapisem zablokowane, dopóki zapis nie
    zostanie przeniesiony lub usunięty. To samo dotyczy usunięcia całej listy
    indeksów.
    - Maksymalnej wielkości zespołu nie da się zmniejszyć poniżej największego
      istniejącego zespołu (komunikat wymienia te sloty). Zwiększenie tylko
      podnosi limit; niepełne zespoły nie są uzupełniane automatycznie.
    - Nazwa, opis i miejsce zmieniają się od razu wszędzie.
    - Listę slotu można zmienić także przy zapisach.
    - Godzinę pojedynczego slotu można edytować (także przy zapisach) z tymi
      samymi sprawdzeniami co okno. Przesuwania całego dnia nie ma.

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
| Daty | date-fns + `@date-fns/tz` (czas polski ↔ UTC); pola natywne `<input type="date">` / `type="time"` |
| CSV | papaparse |
| Config | env walidowany przez t3-env |
| Wdrożenie | Obraz Docker budowany lokalnie, prywatny rejestr `registry:2`, docker compose (sama aplikacja) na VPS za istniejącym NPMplus, osobna baza we wspólnym kontenerze PostgreSQL |

Wersje przypięte dokładnie, bez `^` (`prisma@latest` w npm to 8.0.0-rc — przypiąć 7.x).

## Architektura

Szczegóły: `.scratch/zapisy/issues/13-architektura-i-uklad-plikow.md`.

- `src/routes/` cienkie trasy; `src/domain/` czysta logika (losowanie,
  reguły tablicy, cięcie okna, CSV) bez bazy i HTTP; `src/server/` dostęp do
  bazy i auth (wczytaj → domena → zapisz, pod blokadą zaliczenia);
  `src/components/`; `src/schemas/` (Zod).
- Wzorce, gdy upraszczają: funkcyjny rdzeń + powłoka, wstrzykiwane "teraz"
  i generator losowy, operacje tablicy jako polecenia z poleceniem odwrotnym
  ("Cofnij"), błędy domeny jako wynik z kodem, jedna brama `getOwnedExam`.
- Uprawnienia: middleware `requireUser` / `requireAdmin` na funkcjach
  serwerowych + `getOwnedExam(userId, examId)`.
- Dane: loadery + TanStack Query (`@tanstack/react-router-ssr-query`),
  mutacje przez funkcje serwerowe; tablica optymistycznie, serwer zwraca pełny
  stan; odświeżanie przy powrocie do karty i co 30 s; bez WebSocketów.
- Komunikaty błędów domeny z jednego słownika `messages.pl.ts`; bez
  biblioteki tłumaczeń.
- shadcn: `pnpm dlx shadcn@latest init -t start --base base`, w razie błędu
  #11015 instalacja ręczna.

## Jakość i testy

Szczegóły: `.scratch/zapisy/issues/14-standardy-kodu-i-testy.md`.

- `oxlint` + `oxfmt` (Oxc, wersje przypięte; `oxfmt` w becie). TypeScript
  `strict` + `noUncheckedIndexedAccess`. Kod po angielsku, pliki kebab-case.
- fallow (`.fallowrc.json`): nieużywany kod i zależności, duplikaty,
  cykle, granice warstw (`domain/` bez `server/`, Prismy i Reacta; Prisma
  tylko w `server/`).
- react-doctor (`doctor.config.ts`, uruchamiany z `--no-telemetry`):
  problemy w komponentach React (efekty, wydajność, dostępność).
- Vitest: `domain/` test-first; testy na prawdziwej bazie przez
  Testcontainers (m.in. 50 równoległych zapisów na 5 slotów). Playwright:
  kilka kluczowych ścieżek (zapis zespołu, import CSV, tablica myszą
  i klawiaturą z "Cofnij", logowanie).
- Bez CI i haków git: `pnpm check` (lint, format, typy, fallow, react-doctor, testy) i `pnpm
  release` (check + e2e, potem budowa i wysłanie obrazu). Bez progu pokrycia.

- Każdy formularz jest zbudowany na TanStack Form i walidowany schematem Zod;
  ten sam schemat waliduje dane po stronie serwera. Bez wyjątków dla "małych"
  formularzy.
- Projekt wizualny: kierunek "Przyjazny" (prototyp
  `.scratch/zapisy/prototypes/kierunek-wizualny.html`, wariant C): tło
  `#F4F3FF`, tekst `#1D1B3A` / `#6B6890`, linie `#E2DFF5`, akcent `#4B3FD6`,
  zajęte `#ECEAFD`, wolne mięta `#17A673`, błędy `#C2255C`; krój Figtree;
  zaokrąglenia 12 / 22 px; bilet z gradientem `#4B3FD6` → `#6D5BFF`. Bez
  trybu ciemnego.
- Interfejs po polsku.

## Wdrożenie

- Na VPS są już NPMplus (reverse proxy z SSL) i wspólny kontener PostgreSQL.
  `compose.yaml` aplikacji ma tylko kontener aplikacji, bez wystawionych
  portów, w zewnętrznej sieci Dockera z NPMplus i bazą.
- Baza: osobna baza danych `zapisy` z własnym użytkownikiem we wspólnym
  kontenerze PostgreSQL, zakładana raz ręcznie (SQL w README); tabele
  w `public` tej bazy (Prisma 7 z `@prisma/adapter-pg` ignoruje `?schema=`).
  Kopie zapasowe poza zakresem aplikacji.
- IP klienta tylko z `X-Real-IP` ustawianego przez NPMplus (Better Auth
  i limit prób).
- Obraz: `docker buildx build --platform linux/amd64 --push` lokalnie, do
  prywatnego `registry:2`, tag = wersja z gita, bez `latest`. VPS: `.env`
  z `IMAGE_TAG` + `docker compose up -d`; wycofanie = poprzedni tag.
- Start kontenera: `prisma migrate deploy` → skrypt pierwszego superadmina →
  serwer. Obraz zawiera CLI Prisma i skrypt `reset-password`.
- Env (t3-env): `IMAGE_TAG`, `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `PORT`
  (3000), `TZ` (`Europe/Warsaw`). `.env.example` w repo.

## Świadomie pominięte

- Konta studentów, e-maile, powiadomienia, przypomnienia.
- Zamiana slotów przez samych studentów.
- Lista rezerwowa.
- Osobna encja "przedmiot".
- Daty otwarcia/zamknięcia zapisów.
- Reset hasła mailem (hasło resetuje superadmin).

## Otwarte pytania

Prowadzone jako zadania na mapie: `.scratch/zapisy/map.md`.
