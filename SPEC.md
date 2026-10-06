# Terminus — zapisy na zaliczenia: specyfikacja

Status: gotowa do budowy (2026-09-30). Słownik pojęć: `CONTEXT.md`. Historia
decyzji i ich uzasadnienia: `.scratch/zapisy/map.md` i zadania w
`.scratch/zapisy/issues/`. Decyzja architektoniczna: `docs/adr/0001-prisma-7-zamiast-8.md`.

## 1. Cel

Prowadzący tworzy zaliczenie: importuje listy indeksów z systemu uczelni,
definiuje sloty czasowe. Student wchodzi na link zaliczenia, podaje numer
indeksu (swój albo całego zespołu) i dostaje wylosowany slot, którego sam nie
może zmienić. Prowadzący widzi zapisy na tablicy i poprawia je przeciąganiem.
Aplikacja obsługuje wielu prowadzących i wiele zaliczeń. Interfejs po polsku.

## 2. Role i konta

- **Student** — bez konta; rozpoznawany wyłącznie po numerze indeksu.
- **Prowadzący** — konto Better Auth (e-mail + hasło). Widzi i edytuje tylko
  swoje zaliczenia. Sam zmienia tylko własne hasło (podając obecne).
- **Superadmin** — prowadzący z rolą `admin` (plugin `admin` Better Auth).
  Dodatkowo zarządza kontami; cudzych zaliczeń nie widzi — z jednym wyjątkiem
  poniżej (zablokowane konto).
  - Zakłada konto: e-mail, imię i nazwisko, hasło przekazywane poza
    aplikacją; bez wymuszonej zmiany hasła.
  - Zmienia e-mail i imię i nazwisko prowadzącego; ustawia nowe hasło
    (wylogowuje wszystkie sesje tej osoby); blokuje i odblokowuje konto;
    nadaje i odbiera rolę superadmina. Nie może odebrać roli ani zablokować
    samego siebie.
- Rejestracja publiczna wyłączona (`emailAndPassword.disableSignUp: true`).
- Kont się nie usuwa, tylko blokuje. Zablokowany prowadzący nie zaloguje się;
  jego zaliczenia i linki działają dalej. Przepisywania zaliczeń na inne
  konto nie ma. Superadmin widzi w „Konta” przy zablokowanym koncie listę jego
  zaliczeń (nazwa, liczba zapisów) i może każde usunąć, z potwierdzeniem —
  tak klauzula („do czasu usunięcia zaliczenia przez prowadzącego lub
  administratora aplikacji”) ma kogo wskazać, gdy prowadzący odszedł.
- E-mail służy tylko do logowania: nie jest weryfikowany, aplikacja nic na
  niego nie wysyła.
- Pierwszy superadmin: przy każdym starcie kontenera skrypt czyta
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` i tworzy konto
  (`auth.api.createUser`, rola `admin`) tylko wtedy, gdy tego e-maila nie ma
  w bazie. Istniejącego konta nie rusza.
- Utrata hasła bez innego superadmina:
  `docker compose exec app pnpm reset-password <email>`.

## 3. Model dziedziny

| Pojęcie | W kodzie | Opis |
|---|---|---|
| Zaliczenie | `Exam` | Właściciel, nazwa (z nazwą przedmiotu), opis/miejsce, domyślna długość slotu, maksymalna wielkość zespołu (1 = indywidualne). `id` (UUID v4) jest też linkiem `/z/<id>`. |
| Lista indeksów | `Roster` | Nazwana (np. "g1") lista osób uprawnionych do zapisu; zwykle jedna grupa zajęć z systemu uczelni. Zaliczenie ma jedną lub kilka. |
| Dozwolony indeks | `RosterEntry` | (lista, numer indeksu, imię, nazwisko). Indeks jest najwyżej na jednej liście w zaliczeniu. |
| Numer indeksu | `studentNumber` | Tekst z samych cyfr, najwyżej 20 znaków. |
| Slot | `Slot` | Przedział czasu (`startsAt`, `endsAt`) należący do jednej listy; mieści dokładnie jeden zespół. Sloty zaliczenia nie nachodzą na siebie (także między listami). |
| Okno | `window` | Przedział czasu podany przez prowadzącego, jednorazowo cięty na sloty; nie jest zapisywany. |
| Zapis | `Enrollment` | (zaliczenie, indeks, slot, czas zapisu); najwyżej jeden na indeks w zaliczeniu. Imię i nazwisko pochodzą z listy. |
| Zespół | `team` | Zapisy w tym samym slocie (1 do maksimum osób); bez tabeli. Niepełny zespół też zajmuje cały slot. |
| Losowanie | `draw` | Wybór slotu przy zapisie studenta. |
| Harmonogram | `schedule` | Publiczny widok slotów z nazwiskami. |
| Prowadzący | `User` | Tabela Better Auth; superadmin = `role: "admin"`. |

Kod (modele, pola, zmienne, funkcje) po angielsku; po polsku tylko teksty
interfejsu i komunikaty.

## 4. Strona studenta (`/z/<id>`)

### Harmonogram

- Każdy, kto ma link, widzi wszystkie sloty (także wolne) z imionami
  i nazwiskami zapisanych, bez wpisywania indeksu. Numery indeksów nie są
  pokazywane. Nie ma publicznej listy zaliczeń.
- Oś czasu (najpierw pod telefon; wybrana z prototypu 2026-10-01, gałąź
  `prototyp-harmonogram`): nad nią zakładki dni z liczbą wolnych slotów (przy
  jednym dniu bez zakładek), na starcie wybrany pierwszy dzień z wolnym slotem.
  Godziny pełne po lewej, sloty jako bloki o wysokości proporcjonalnej do
  długości (najkrótszy slot dnia co najmniej 40 px), przerwy między oknami
  widoczne. Blok: godzina początku + imiona i nazwiska zespołu (ucięte, gdy
  się nie mieszczą); wolny blok opisany "wolny". Dotknięcie zajętego bloku
  rozwija w miejscu pełny skład zespołu.
- Legenda: wolny, zajęty, Twój.
- Minione sloty wyglądają jak pozostałe, ale pusty miniony slot nie jest
  opisany jako "wolny" (nie da się go wylosować).
- Przy więcej niż jednej liście: przełącznik "Wszystkie / g1 / g2" nad
  planszą i nazwa listy na kafelku slotu.
- Nagłówek: nazwa zaliczenia, miejsce, prowadzący.
- Świeżość: odświeżanie przy powrocie do karty i co 30 s przy widocznej karcie.

### Zapis

- Przycisk "Zapisz się" przypięty na dole otwiera panel wysuwany z dołu.
  W panelu pola na numery indeksów (tylko numery — imiona i nazwiska
  z listy), "Dodaj osobę do zespołu (n/maks.)" do maksymalnej wielkości
  zespołu, "Usuń" przy dodanej osobie, jeden przycisk "Losuj slot", pod
  spodem zwinięta klauzula informacyjna RODO. Przy zaliczeniu indywidualnym
  bez wzmianek o zespole.
- Po wysłaniu krótki stan "Losowanie slotu…" (co najmniej 700 ms, nawet gdy
  serwer odpowie szybciej), potem w panelu bilet: dzień,
  godzina, miejsce, skład zespołu (imiona, nazwiska, numery indeksów) i zdanie,
  że slot jest przydzielony na stałe. "Pokaż na planszy" zamyka panel;
  kafelek wyniku jest wyróżniony i krótko pulsuje, a przycisk na dole zmienia
  się na "Twój slot".
- Reguły:
  1. Cały zapis jest odrzucany (nic się nie zapisuje), gdy którykolwiek indeks:
     nie jest na żadnej liście zaliczenia; ma już zapis; jest z innej listy niż
     pozostali członkowie zespołu; jest wpisany dwa razy.
  2. Indeks z istniejącym zapisem: komunikat podaje dzień i godzinę jego
     slotu; nigdy nie losuje ponownie. Przy jednej osobie komunikat
     informacyjny (zielony), przy zespole błąd (czerwony) ze zdaniem, że
     nikogo nie zapisano. Ponowne wejście studenta nie ma osobnego ekranu —
     wpisuje indeks jeszcze raz.
  3. Brak wolnych slotów → komunikat, bez zapisu. Gdy brak wolnych slotów już
     przy wejściu: komunikat nad planszą, a zamiast "Zapisz się" przycisk
     "Sprawdź swój slot" (ten sam panel; zapisany indeks dostaje swój slot).
  4. Student nie zmienia ani nie usuwa zapisu. Zmianę slotu załatwia
     z prowadzącym poza aplikacją. Spóźniony członek zespołu losuje osobny
     slot; do istniejącego zespołu dopisuje go tylko prowadzący.
  5. Zapisy otwarte od startu zapisów (data i godzina w ustawieniach
     zaliczenia, czas polski; puste = od utworzenia) do wyczerpania miejsc; bez
     daty zamknięcia. Przed startem harmonogram jest widoczny, nad nim komunikat
     "Zapisy ruszają <dzień, godzina>", bez przycisku zapisu; serwer odrzuca
     zapis (NOT_OPEN_YET). Strona odświeża się co 30 s, więc przycisk pojawia
     się sam.
- Komunikaty nad polami, pole z problematycznym indeksem podświetlone.
  Osobne komunikaty dla: indeksu nie ma na liście, indeks ma już zapis,
  indeks z innej listy, brak wolnych slotów, limit prób, brak danych, ten sam
  indeks dwa razy.

### Ochrona i dane osobowe

- Limit: 10 nieudanych prób "indeksu nie ma na liście" na 10 minut z jednego
  IP; próba zespołu kosztuje tyle punktów, ile numerów sprawdzono (`rate-limiter-flexible`, `RateLimiterMemory`; po restarcie liczniki się
  zerują). Udane zapisy i "indeks ma już zapis" się nie liczą — wielu
  studentów za jednym adresem uczelnianej sieci. Bez CAPTCHA.
- Adres IP limitu nie trafia do klauzuli informacyjnej (decyzja z code
  review): jest tylko kluczem licznika w pamięci procesu, najdłużej 10 minut,
  bez zapisu do bazy i logów.
- IP klienta wyłącznie z nagłówka `X-Real-IP` ustawianego przez reverse proxy.
- Strony `/z/…` mają `noindex` i nie mają podglądu linku (Open Graph)
  z nazwiskami.
- Klauzula informacyjna RODO: stały tekst z `docs/klauzula-informacyjna.md`
  (oparty na klauzuli AGH dla studentów). **Przed uruchomieniem do akceptacji
  Inspektora Ochrony Danych AGH.**
- Dane nie są usuwane automatycznie; usuwa je prowadzący, kasując zaliczenie.
- Świadomie przyjęte ryzyko: kto zna cudzy indeks, może tę osobę zapisać
  i zobaczy jej imię i nazwisko na bilecie; nazwiska w harmonogramie widzi
  każdy posiadacz linku.

## 5. Losowanie i współbieżność

- Pula: wolne sloty listy, na której są indeksy zespołu, które jeszcze się nie
  zaczęły (`startsAt > now()`).
- Najpierw dzień (każdy dzień z co najmniej jednym slotem z puli, z równą
  szansą — w strefie `Europe/Warsaw`), potem slot w tym dniu (z równą
  szansą).
- Losowość: `crypto.randomInt`, bez ziarna; wynik nieodtwarzalny. W bazie
  tylko czas zapisu; zapis z losowania nie jest odróżniany od ręcznego.
- Transakcja zapisu zaczyna się od `SELECT … FOR UPDATE` na wierszu
  zaliczenia (izolacja `READ COMMITTED`): zapisy na jedno zaliczenie
  wykonują się po kolei; sprawdzenia, losowanie i wstawienie zapisów dzieją
  się pod blokadą. Nikt nie "przegrywa" slotu — następny losuje z tego, co
  zostało. Bez ponawiania.
- Wszystkie operacje prowadzącego zmieniające sloty, listy i zapisy biorą tę
  samą blokadę.
- Unikalność (zaliczenie, indeks) w bazie jako ostatnia zapora.

## 6. Część prowadzącego

### Zaliczenia

- Lista własnych zaliczeń; tworzenie, edycja, usuwanie, duplikowanie.
- Pola: nazwa, opis/miejsce, domyślna długość slotu (minuty, 1–480),
  maksymalna wielkość zespołu oraz do 5 dodatkowych pól tekstowych dla
  studenta (nazwa, np. "Tytuł projektu", i znacznik "wymagane").
- Dodatkowe pola (2026-10-01): wypełnia student przy zapisie, raz na zespół
  (wartości wspólne dla zespołu/slotu; brak wymaganego = zapis odrzucony,
  komunikat "Uzupełnij: …"). Widoczne na bilecie, na tablicy prowadzącego
  (✎ poprawia odpowiedzi zespołu) i jako kolumny eksportu CSV; nie w publicznym
  harmonogramie. Osoba dołączana na tablicy do istniejącego zespołu przejmuje
  jego odpowiedzi; przeniesiony cały zespół zachowuje swoje. Duplikat kopiuje
  definicje pól.
- Link zaliczenia z przyciskiem "kopiuj".
- Przed udostępnieniem linku, osobno dla każdej listy: liczba indeksów vs.
  liczba miejsc w jej slotach, z ostrzeżeniem, gdy miejsc jest mniej.
- Usunięcie zaliczenia kasuje kaskadowo listy, wpisy, sloty i zapisy;
  wymaga wpisania nazwy zaliczenia.
- "Duplikuj zaliczenie" (poprawka = nowe zaliczenie): kopiuje nazwę
  z dopiskiem "(kopia)", opis, ustawienia oraz — przy zaznaczonym "Kopiuj
  listy indeksów" (domyślnie tak) — listy z nazwiskami. Bez slotów i zapisów.
- Edycja przy istniejących zapisach:
  - maksymalnej wielkości zespołu nie da się zmniejszyć poniżej największego
    istniejącego zespołu (komunikat wymienia te sloty); zwiększenie tylko
    podnosi limit, niepełne zespoły nie są uzupełniane;
  - nazwa, opis i miejsce zmieniają się od razu wszędzie;
  - zmiana domyślnej długości slotu nie rusza istniejących slotów.

### Listy indeksów

- Import pliku CSV w formacie eksportu z systemu uczelni: UTF-8 z BOM, końce
  linii CRLF, separator `;`, pola w cudzysłowach, nagłówek z kolumnami
  `nazwisko`, `imie`, `imie2`, `skreslony`, `rezygnacja`, `email`, `indeks`
  (czyta `papaparse`). Bez wklejania tekstu.
- Podgląd przed zapisem: nazwa listy podpowiedziana z nazwy pliku (np.
  `studenci_110-ITE-2S-027_g1_2026-09-30.csv` → "g1"), do zmiany; liczba
  osób; wiersze pominięte i błędne.
- Imię = `imie`, nazwisko = `nazwisko` (drugie imię pomijane).
- Pomijane: `skreslony = 1` lub `rezygnacja = 1`. Błędne i nieimportowane:
  indeks nie z samych cyfr; indeks już na innej liście zaliczenia. Brak
  kolumny `indeks`, `imie` lub `nazwisko` → cały plik odrzucony.
- Ponowny import do istniejącej listy: nowe indeksy dopisane, nazwiska
  zaktualizowane; indeksy nieobecne w pliku zostają (podgląd je wymienia);
  `skreslony = 1` znika z listy — także gdy ma zapis: zapis jest usuwany
  (w zespole zostają pozostałe osoby). Podgląd wymienia osobno skreślonych
  z zapisem (dzień i godzina slotu), zanim prowadzący zatwierdzi import. Nic
  nie znika po cichu.
- Ręczne dodanie pojedynczej osoby do listy: indeks, imię, nazwisko i lista.
  Gdy zaliczenie nie ma jeszcze żadnej listy, osoba trafia na nowo założoną
  listę "lista".
- Zaliczenie z jedną listą nie pokazuje w interfejsie żadnych "list".
- Usunięcie indeksu lub całej listy z zapisem jest zablokowane, dopóki zapis
  nie zostanie przeniesiony lub usunięty (wyjątek: skreślony w ponownym
  imporcie, wyżej).

### Sloty

- Formularz okna: data, godzina od, godzina do, długość slotu (domyślnie
  z zaliczenia), lista (wymagana przy więcej niż jednej liście). Jedno
  wysłanie = jedna data i jedno okno; po zapisaniu formularz zostaje otwarty
  z tymi samymi godzinami.
- Aplikacja tnie okno na sloty i zapisuje je jako osobne rekordy. Okno
  mieści się w jednym dniu, "do" później niż "od"; daty z przeszłości
  dozwolone. Reszta z dzielenia przepada (9:00–12:00 po 25 min → 7 slotów do
  11:55); okno krótsze niż jeden slot jest odrzucane.
- Podgląd na żywo: liczba slotów, ich godziny, niewykorzystane minuty.
- Bez przerw między slotami jako ustawienia; przerwa = dwa okna albo usunięty
  slot.
- Okno kolidujące z choć jednym istniejącym slotem zaliczenia jest odrzucane
  w całości, z komunikatem wskazującym slot. Stykanie się dozwolone.
- Zaliczenie może mieć sloty różnej długości.
- Slot bez zapisów można usunąć pojedynczo; przy każdym dniu przycisk "usuń
  wolne sloty" (sloty z zapisami zostają, komunikat mówi, ile pominięto).
  Slotu z zapisem nie da się usunąć.
- Godzinę pojedynczego slotu można edytować (także przy zapisach) z tymi
  samymi sprawdzeniami co okno. Listę slotu można zmienić (także przy
  zapisach). Po dodaniu drugiej listy istniejące sloty zostają przy pierwszej.
  Przesuwania całego dnia nie ma.

### Tablica zapisów

- Układ: po lewej przyklejony panel "Niezapisani" (liczba, wyszukiwarka
  indeksu, kafelki z numerem; przy kilku listach podzielony na listy); po
  prawej tabela slotów: wiersz = slot, kolumny: dzień (tylko w pierwszym
  wierszu dnia, dni oddzielone grubszą linią), godzina z uchwytem całego
  zespołu, lista (przy kilku listach), zespół jako kafelki w jednej linii albo
  "wolny".
- Nad tabelą: nazwa zaliczenia, liczby (zapisani / indeksy, wolne sloty,
  miejsca), ostrzeżenia o miejscach, wyszukiwarka "Znajdź indeks albo
  nazwisko" podświetlająca pasujące kafelki.
- Kafelek osoby: imię i nazwisko, numer indeksu, przycisk ✎ — edycja
  imienia i nazwiska w miejscu (Enter zapisuje, Esc anuluje); zmienia wpis na
  liście. Kafelek w slocie cudzej listy ma dopisek nazwy swojej listy.
- Przeciąganie (tylko przeciąganie, bez list "Przenieś do…"):
  - osoba → slot z wolnym miejscem: przeniesienie;
  - osoba → inna osoba: zamiana slotów tych dwóch osób;
  - osoba → pełny slot (zespół o maksymalnej wielkości): odrzucone
    z komunikatem, czerwone podświetlenie w trakcie;
  - osoba → "Niezapisani": usunięcie zapisu (student może losować od nowa);
  - "Niezapisany" → slot z wolnym miejscem: ręczny zapis (imię i nazwisko
    z listy, bez pytania); na osobę — odrzucone. Osobę spoza list
    prowadzący najpierw dodaje do listy;
  - cały zespół (uchwyt) → wolny slot: przeniesienie; → slot z innym
    zespołem: zamiana zespołów;
  - przenoszenie między slotami różnych list dozwolone bez ostrzeżenia.
- Każda operacja kończy się komunikatem u dołu z przyciskiem "Cofnij" (kilka
  sekund); bez okien potwierdzenia. "Cofnij" wykonuje polecenie odwrotne.
- Klawiatura: domyślny sensor klawiatury `@dnd-kit/react` (Tab do kafelka,
  Spacja podnosi, strzałki przesuwają o 10 px / z Shift o 50 px, Spacja
  upuszcza, Esc anuluje). Komunikaty dla czytnika ekranu po polsku
  (`Accessibility.configure()`).
- Aktualizacja optymistyczna; serwer po każdej operacji zwraca pełny stan
  tablicy, który zastępuje dane w przeglądarce; przy błędzie cofnięcie
  i komunikat. Odświeżanie przy powrocie do karty i co 30 s.

### Eksport CSV

- Tylko właściciel. Kolumny `data` (RRRR-MM-DD), `od`, `do`, `lista`,
  `indeks`, `nazwisko`, `imie`; wiersz na osobę; sortowanie po początku slotu,
  w slocie po nazwisku; niezapisani na końcu z pustymi kolumnami czasu; wolne
  sloty pominięte.
- Format jak import: UTF-8 z BOM, `;`, pola w cudzysłowach (`papaparse`
  `unparse`). Plik `<nazwa-zaliczenia>_<RRRR-MM-DD>.csv` (data eksportu).

## 7. Baza danych

PostgreSQL (wspólny kontener na VPS, osobna baza `zapisy`), Prisma 7
z `@prisma/adapter-pg`. Tabele Better Auth (`User` z polami pluginu `admin`,
`Session`, `Account`, `Verification`) generuje `auth generate` do tego samego
pliku schematu. Dokładne nazwy tabel (`@@map`) przy budowie.

```prisma
model Exam {
  id                 String   @id @default(uuid())   // też link /z/<id>
  ownerId            String
  owner              User     @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  name               String
  description        String
  defaultSlotMinutes Int
  maxTeamSize        Int
  fields             Json     @default("[]")  // [{ id, label, required }]
  enrollmentOpensAt  DateTime? @db.Timestamptz  // start zapisów; null = od razu
  createdAt          DateTime @default(now())
}

model Roster {
  id     String @id @default(uuid())
  examId String            // Exam onDelete: Cascade
  name   String
  @@unique([examId, name])
  @@unique([id, examId])   // cel złożonych kluczy obcych
}

model RosterEntry {
  examId        String
  studentNumber String
  rosterId      String     // [rosterId, examId] -> Roster, onDelete: Cascade
  firstName     String
  lastName      String
  @@id([examId, studentNumber])
}

model Slot {
  id       String   @id @default(uuid())
  examId   String            // [rosterId, examId] -> Roster, onDelete: Cascade
  rosterId String
  startsAt DateTime @db.Timestamptz
  endsAt   DateTime @db.Timestamptz
  @@unique([id, examId])
  @@index([examId, startsAt])
}

model Enrollment {
  examId        String   // Exam onDelete: Cascade (kasuje zapisy w tym samym poleceniu)
  studentNumber String   // [examId, studentNumber] -> RosterEntry, onDelete: NoAction
  slotId        String   // [slotId, examId] -> Slot, onDelete: NoAction
  createdAt     DateTime @default(now())
  answers       Json     @default("{}")   // id pola → tekst, wspólne dla zespołu
  @@id([examId, studentNumber])
}
```

- Czas: `timestamptz` (UTC). Prowadzący wpisuje czas polski, przeliczenie
  przez `@date-fns/tz`; grupowanie po dniach i wyświetlanie w `Europe/Warsaw`.
- Baza pilnuje: unikalności (zaliczenie, indeks) na listach i w zapisach;
  unikalnej nazwy listy w zaliczeniu; spójności zaliczenia (złożone klucze
  obce z `examId`); blokady usunięcia slotu, wpisu listy i listy z zapisem
  (`NoAction`, sprawdzane na końcu polecenia, więc kaskada z `Exam` działa).
- Kod pod blokadą zaliczenia pilnuje: pojemności slotu, nienachodzenia slotów,
  zespołu z jednej listy, końca slotu po początku.

## 8. Architektura

```
src/
  routes/       trasy TanStack Router, cienkie (loader + komponent)
    z/$examId.tsx     strona studenta
    _authed/…         część prowadzącego (beforeLoad → przekierowanie na logowanie)
    api/auth/$.ts     handler Better Auth
  domain/       czysta logika bez bazy i HTTP: losowanie (draw.ts), reguły tablicy
                (board.ts), cięcie okna, parsowanie i eksport CSV
  server/       funkcje serwerowe (exams.ts, board.ts, …) wołane z UI; kod tylko
                serwerowy w *.server.ts: db.server.ts (jeden klient Prisma),
                auth.server.ts, enrollment.server.ts, board-ops.server.ts, …
                (blokada → wczytaj → domain → zapisz); ochrona importów TanStack
                Start przerywa build, gdy kod przeglądarki importuje *.server.ts
  components/   UI; shadcn w components/ui
  schemas/      schematy Zod wspólne dla formularzy i serwera
  messages.pl.ts  kody błędów domeny → zdania po polsku
```

- Wzorce, gdy upraszczają kod: funkcyjny rdzeń (`domain/`) + powłoka
  z bazą (`server/`); "teraz" i generator losowy przekazywane do
  `domain/draw.ts` (deterministyczne testy); operacje tablicy jako polecenia
  `{ kind, … }` walidowane i stosowane przez `domain/board.ts`, każde zwraca
  polecenie odwrotne ("Cofnij"); błędy domeny jako wynik z kodem
  (`{ ok: false, code: "SLOT_FULL" | "NOT_ON_ROSTER" | "ALREADY_ENROLLED" | … }`),
  nie wyjątki. Bez warstw i interfejsów na zapas.
- Dostęp do bazy tylko w `server/` (tanie przejście na Prisma 8 w przyszłości).
- Uprawnienia: middleware `requireUser` (sesja; zablokowane konto = odmowa)
  i `requireAdmin` podpinane `.middleware([...])` do każdej funkcji
  serwerowej prowadzącego / superadmina; każde zapytanie o zaliczenie przez
  `getOwnedExam(userId, examId)`, które dla cudzego zaliczenia zwraca "nie
  znaleziono". `beforeLoad` tylko przekierowuje.
- Dane: TanStack Query zintegrowane z routerem przez
  `@tanstack/react-router-ssr-query` (`setupRouterSsrQueryIntegration({ router, queryClient })`);
  loadery `context.queryClient.query({ ...opcje, staleTime: "static" })`; zmiany przez
  `useMutation` → funkcje serwerowe. Bez WebSocketów.
- Formularze: każdy na TanStack Form, walidowany schematem Zod; ten sam
  schemat waliduje dane na serwerze. Bez wyjątków dla małych formularzy.
- Better Auth: adapter Prisma, `tanstackStartCookies()` jako ostatni plugin,
  sesja przez `auth.api.getSession({ headers })`,
  `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]`.
- Komunikaty: teksty UI wpisane w komponentach; błędy domeny z
  `messages.pl.ts`; bez biblioteki tłumaczeń. Nieoczekiwany błąd → ogólny
  komunikat po polsku + log kontenera.

## 9. Wygląd

Kierunek "Przyjazny" (prototyp `.scratch/zapisy/prototypes/kierunek-wizualny.html`,
wariant C), jako zmienne motywu shadcn/ui:

| Rola | Kolor |
|---|---|
| tło | `#F4F3FF` |
| powierzchnia | `#FFFFFF` |
| tekst / drugorzędny | `#1D1B3A` / `#6B6890` |
| linie | `#E2DFF5` |
| akcent (przyciski, "Twój" slot) | `#4B3FD6` |
| zajęty slot, kafelek | `#ECEAFD` |
| wolny slot | `#17A673` (mięta) |
| ostrzeżenia, błędy | `#C2255C` |

- Krój Figtree (400/600/800) do wszystkiego; godziny cyframi tabelarycznymi.
- Zaokrąglenia: małe elementy 12 px, karty i panele 22 px. Luźny układ;
  bazowy rozmiar tekstu 17 px na stronie studenta.
- Bilet: gradient `#4B3FD6` → `#6D5BFF`, biały tekst, wycięcia po bokach,
  przerywana linia nad składem zespołu — jedyne "głośne" miejsce.
- Wolny slot: biała karta z miętowym obramowaniem; zajęty: jasny fiolet.
- Bez trybu ciemnego.
- Układ ekranów studenta i tablicy: prototypy
  `.scratch/zapisy/prototypes/strona-studenta.html` (wariant B)
  i `tablica-prowadzacego.html` (wariant C, bez list "Przenieś do…") — wiążące
  są opisy w tej specyfikacji, nie kod prototypów.

## 10. Stos i wersje

Wersje w `package.json` przypięte dokładnie (bez `^`), sprawdzone w npm
2026-09-30. Aktualizacje świadomie, skillem `update-deps`.

| Pakiet | Wersja | Uwagi |
|---|---|---|
| `@tanstack/react-start` | 1.168.60 | formalnie RC, API stabilne |
| `@tanstack/react-router` | 1.170.41 | |
| `@tanstack/react-query` | 5.104.0 | |
| `@tanstack/react-router-ssr-query` | 1.167.3 | |
| `@tanstack/react-form` | 1.33.5 | |
| `react`, `react-dom` | 19.3.0 | |
| `vite` | 8.3.1 | TanStack Start wymaga ≥ 7 |
| `@vitejs/plugin-react` | 6.1.1 | |
| `nitro` | 3.0.260903-beta | serwer Node (`.output/server/index.mjs`); beta |
| `prisma` (dev), `@prisma/client`, `@prisma/adapter-pg` | 7.10.0 | **`prisma@latest` to 8.0.0-rc — instalować `prisma@7.10.0`** |
| `better-auth`, `@better-auth/prisma-adapter` | 1.7.6 | |
| `zod` | 4.6.5 | |
| `@dnd-kit/react` | 0.5.0 | 0.x |
| `date-fns` / `@date-fns/tz` | 4.4.0 / 1.5.0 | |
| `papaparse` | 5.7.0 | |
| `@t3-oss/env-core` | 0.13.11 | |
| `rate-limiter-flexible` | 11.2.1 | |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.3 | |
| `shadcn` (CLI) | 4.21.0 | wariant Base UI: `--base base` |
| `@base-ui/react` | 1.8.0 | instaluje shadcn |
| `typescript` | 6.0.3 | ostatnia linia na starym kompilatorze w JS; 7.0.2 (natywny) później, gdy narzędzia potwierdzą zgodność |
| `oxlint` / `oxfmt` | 1.86.0 / 0.71.0 | `oxfmt` w becie |
| `fallow` | 3.31.0 | |
| `react-doctor` | 0.9.14 | 0.x |
| `vitest` | 5.0.3 | |
| `@testcontainers/postgresql` | 12.2.0 | |
| `@playwright/test` | 1.63.0 | |

Node 24 (LTS) w obrazie i lokalnie; menedżer pakietów pnpm.

## 11. Jakość i testy

- `oxlint` (reguły zależne od typów) + `oxfmt`; TypeScript `strict` +
  `noUncheckedIndexedAccess` (bez `exactOptionalPropertyTypes`).
- Nazwy: pliki kebab-case (`board-ops.ts`), trasy wg konwencji TanStack
  Router; komponenty `PascalCase`; funkcje i zmienne `camelCase`;
  `UPPER_SNAKE` tylko dla prawdziwych stałych.
- `fallow` (`.fallowrc.json`): nieużywane pliki, eksporty i zależności,
  duplikaty, cykle, granice warstw — `domain/` nie importuje `server/`,
  Prismy ani Reacta; klienta Prisma importuje tylko `server/`; `routes/` nie
  sięga do bazy.
- `react-doctor --no-telemetry` (`doctor.config.ts`): problemy komponentów
  React.
- Vitest, `domain/` pisane test-first: losowanie z podstawionym generatorem,
  reguły tablicy (przeniesienie, zamiana, pełny slot, cudza lista, polecenie
  odwrotne), cięcie okna, parsowanie CSV (plik testowy z BOM i `;`, dane
  wymyślone).
- Vitest + Testcontainers na prawdziwym PostgreSQL: 50 równoległych zapisów
  na zaliczenie z 5 slotami → dokładnie 5 zespołów, bez przepełnienia
  i podwójnych zapisów; blokady usunięcia (`NoAction`); kaskada przy usunięciu
  zaliczenia.
- Playwright: zapis zespołu i bilet; indeks z zapisem dostaje swój slot;
  import CSV; przeniesienie na tablicy myszą i klawiaturą + "Cofnij";
  logowanie i blokada konta.
- Bez CI i haków git. `pnpm check` = oxlint, `oxfmt --check`, `tsc`, fallow,
  react-doctor, testy jednostkowe i bazodanowe. `pnpm release` = `check` +
  e2e, potem budowa i wysłanie obrazu. Bez progu pokrycia: każda reguła
  z `domain/` ma test, każda ścieżka zapisu ma test na bazie.

## 12. Wdrożenie

- Na VPS działają NPMplus (reverse proxy z SSL) i wspólny kontener
  PostgreSQL. `compose.yaml` aplikacji ma tylko kontener aplikacji: bez
  wystawionych portów, w zewnętrznej sieci Dockera z NPMplus i bazą (nazwy
  sieci wpisane na VPS). NPMplus łączy się z aplikacją po nazwie kontenera.
- Baza: osobna baza danych `zapisy` z własnym użytkownikiem, zakładana raz
  ręcznie (SQL w README); tabele w `public` tej bazy. Kopie zapasowe poza
  zakresem aplikacji.
- Obraz: `docker buildx build --platform linux/amd64 --push` lokalnie, do
  prywatnego `registry:2`; tag = wersja z gita, plus `latest` na ostatni release. Na VPS tylko
  `compose.yaml` i `.env`; wdrożenie = `IMAGE_TAG` w `.env` +
  `docker compose up -d`; wycofanie = poprzedni tag — migracje zgodne wstecz
  (dodaj teraz, usuń w kolejnym wydaniu) i `pg_dump` przed `up -d` (README).
- Start kontenera: `prisma migrate deploy` → skrypt pierwszego superadmina →
  `node .output/server/index.mjs`. Obraz zawiera produkcyjne `node_modules`
  (CLI Prisma, bez narzędzi deweloperskich), skrypty `seed-admin` i
  `reset-password` oraz `HEALTHCHECK` na stronę logowania.
- Env (walidowane przez t3-env; brak = aplikacja nie startuje), `.env` na VPS
  poza repo, `.env.example` w repo: `IMAGE`, `IMAGE_TAG`, `PROXY_NETWORK`, `DB_NETWORK`, `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
  `ADMIN_NAME`, `PORT` (3000), `TZ` (`Europe/Warsaw`).

## 13. Kolejność budowy

Pierwsze kroki sprawdzają założenia, na których stoi reszta:

1. Szkielet: `pnpm dlx shadcn@latest init -t start --base base` (przy błędzie
   #11015 — instalacja ręczna shadcn wg dokumentacji), Node 24, przypięte
   wersje z sekcji 10, oxlint/oxfmt/fallow/react-doctor, `pnpm check`.
   Sprawdzić: czy fallow rozpoznaje trasy TanStack Start jako punkty
   wejścia; czy react-doctor zwraca kod błędu przy znaleziskach.
2. Prisma 7 + schemat z sekcji 7 + Better Auth (adapter Prisma, plugin
   `admin`, `disableSignUp`). Test: `createUser` działa przy wyłączonej
   rejestracji; skrypt pierwszego superadmina jest idempotentny.
3. `domain/` test-first (losowanie, cięcie okna, CSV, reguły tablicy).
4. `server/enrollment.ts` + test współbieżności na Testcontainers (50 zapisów
   na 5 slotów) — zanim cokolwiek innego oprze się na zapisie.
5. Część prowadzącego: zaliczenia, import list, sloty, konta superadmina.
6. Strona studenta (plansza, panel zapisu, bilet, limit prób, RODO,
   `noindex`).
7. Tablica zapisów (`@dnd-kit/react`); e2e przeciągania myszą — to nie
   zostało sprawdzone w prototypie.
8. Eksport CSV, duplikowanie, edycja po starcie.
9. Obraz, `compose.yaml`, README (SQL bazy, wdrożenie, `reset-password`).
   Na VPS sprawdzić: wersję PostgreSQL (Prisma 7: 9.6–18) i że NPMplus
   nadpisuje `X-Real-IP`.
10. Przed uruchomieniem: akceptacja klauzuli RODO przez IOD AGH.

## 14. Świadomie pominięte

- Konta studentów, e-maile, powiadomienia, przypomnienia; reset hasła mailem.
- Zamiana slotów przez studentów; lista rezerwowa.
- Osobna encja "przedmiot"; data zamknięcia zapisów.
- Wklejanie list indeksów tekstem.
- Usuwanie kont prowadzących; przepisywanie zaliczeń na inne konto;
  wgląd superadmina w cudze zaliczenia.
- Przerwy między slotami jako ustawienie; wybór wielu dat w formularzu okna;
  przesuwanie całego dnia.
- Kopie zapasowe bazy (po stronie właściciela wspólnej bazy); CI; tryb ciemny.
- Automatyczne usuwanie danych po czasie; audyt i odtwarzalność losowania.
