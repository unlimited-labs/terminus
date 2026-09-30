# Grupy zajęciowe i import CSV

Type: grilling
Status: resolved

## Question

Nowe wymaganie użytkownika (2026-09-30): lista indeksów ma dać się
zaimportować z pliku CSV, a indeksy (także przy imporcie) mogą mieć
ograniczenie, z których slotów wolno im losować — żeby student trafił tylko na
zaliczenie w czasie zajęć swojej grupy.

Do rozstrzygnięcia:

- Jak nazywamy to pojęcie? "Grupa" jest w `CONTEXT.md` na liście unikanych
  jako synonim zespołu — tu chodzi o coś innego (grupa zajęciowa z planu
  studiów, np. `g1` w nazwie pliku). Czy to osobny byt zaliczenia (grupa
  z nazwą, lista indeksów, lista slotów), czy tylko etykieta na indeksie
  i na slocie?
- Jak prowadzący przypisuje sloty do grupy (przy generowaniu okna, na slocie,
  na dniu)? Czy slot może należeć do kilku grup? Czy są sloty wspólne dla
  wszystkich?
- Import: jeden plik = jedna grupa? Skąd nazwa grupy (z nazwy pliku, wpisana
  przez prowadzącego)? Co z indeksem, który już jest na liście (w tej samej
  lub innej grupie)? Czy import dopisuje, czy zastępuje listę? Co z wierszami
  `skreslony = 1` / `rezygnacja = 1`?
- Czy z CSV bierzemy imię i nazwisko? Dziś zapis zawiera imię i nazwisko
  wpisane przez studenta; lista indeksów trzyma same numery. Jeśli lista ma
  nazwiska — czy student nadal je wpisuje, czy tylko indeks? Wpływa na
  formularz ze [Strona studenta](09-strona-studenta.md) i na ryzyko z
  [Ochrona strony studenta](08-ochrona-strony-studenta.md).
- Losowanie: [Algorytm losowania](06-algorytm-losowania.md) losuje dzień, potem
  slot, spośród wolnych. Z grupami — tylko spośród slotów grupy tego indeksu.
  Zespół z członkami z różnych grup: dozwolony? Jeśli tak, które sloty?
- Tablica prowadzącego: czy przeniesienie osoby na slot innej grupy jest
  dozwolone (prowadzący może wszystko), z ostrzeżeniem, czy zablokowane? Czy
  "niezapisani" są pogrupowani?
- Harmonogram dla studenta: czy pokazuje wszystkie sloty, czy tylko sloty
  jego grupy (student nie podaje indeksu przed zapisem)?
- Czy wklejanie indeksów tekstem zostaje obok importu CSV?

## Answer

- "Grupa" w słowniku użytkownika = zespół (osoby zaliczające razem w slocie); słowo zostaje na liście unikanych. Nowe wymaganie wyrażamy istniejącym pojęciem **lista indeksów**: zaliczenie ma jedną lub kilka list, każda z nazwą (np. "g1").
- Każdy slot należy do jednej listy. Indeks jest najwyżej na jednej liście w zaliczeniu i losuje tylko ze slotów swojej listy. Zaliczenie z jedną listą działa jak dotąd.
- Sloty zaliczenia nadal nie nachodzą na siebie, także między listami (zajęcia list nie odbywają się równolegle).
- Student wpisuje tylko numery indeksów; imię i nazwisko pochodzi z listy (także w harmonogramie i na bilecie). Świadomie przyjęte: kto wpisze cudzy indeks, zobaczy nazwisko tej osoby na bilecie.
- Lista powstaje tylko z importu CSV w formacie uczelni oraz przez ręczne dodanie pojedynczego indeksu z imieniem i nazwiskiem. Wklejanie tekstu usunięte.
- Import: podgląd przed zapisem (nazwa listy podpowiedziana z nazwy pliku, do zmiany; liczba osób; wiersze pominięte i błędne). Imię i nazwisko = `imie` + `nazwisko`. Pomijane `skreslony = 1` / `rezygnacja = 1`. Błędne i nieimportowane: indeks nie z samych cyfr, indeks już na innej liście zaliczenia. Brak kolumny `indeks`, `imie` lub `nazwisko` → plik odrzucony.
- Ponowny import do istniejącej listy: dopisuje nowe indeksy, aktualizuje nazwiska; indeksy nieobecne w pliku zostają (podgląd je wymienia); `skreslony = 1` bez zapisu znika, z zapisem zostaje i jest oznaczony. Nic nie znika po cichu.
- Sloty do list: pole "Lista" w formularzu okna (wymagane przy więcej niż jednej liście); listę pojedynczego slotu można zmienić; po dodaniu drugiej listy istniejące sloty zostają przy pierwszej.
- Zespół z indeksami z różnych list → cały zapis odrzucony, komunikat wskazuje indeks z innej listy.
- Tablica prowadzącego: przenoszenie między slotami różnych list dozwolone bez ostrzeżenia; kolumna "Lista" przy slocie; "Niezapisani" podzieleni na listy; kafelek w slocie cudzej listy z dopiskiem nazwy swojej listy. Ręczny zapis bierze nazwisko z listy — okno z polem imię i nazwisko z [Tablica zapisów prowadzącego](10-tablica-zapisow-prowadzacego.md) odpada; osobę spoza list prowadzący najpierw dodaje do listy. Edycja nazwiska na kafelku zmienia wpis na liście.
- Harmonogram studenta: przy więcej niż jednej liście przełącznik "Wszystkie / g1 / g2" nad planszą i nazwa listy na kafelku slotu.
- Ostrzeżenie "indeksy vs. miejsca" liczone osobno dla każdej listy.
- Usunięcie listy zablokowane, dopóki ma indeksy z zapisem (jak usunięcie indeksu).

## Fakty o pliku

Przykładowy plik od użytkownika: `studenci_110-ITE-2S-027_g1_2026-09-30.csv`
(nie trafia do repo — dane osobowe).

- Eksport z systemu uczelni: UTF-8 z BOM, końce linii CRLF, separator `;`,
  każde pole w cudzysłowach, pierwszy wiersz to nagłówek.
- Kolumny: `nazwisko`, `imie`, `imie2` (drugie imię, bywa puste), `skreslony`
  (`0`/`1`), `rezygnacja` (`0`/`1`), `email`, `indeks`.
- W próbce: 27 osób, wszystkie indeksy 6-cyfrowe, wszystkie `skreslony` i
  `rezygnacja` = `0`. Nazwa pliku zawiera kod przedmiotu (`110-ITE-2S-027`),
  grupę (`g1`) i datę eksportu.
- `papaparse` (już w stosie) czyta taki plik: separator `;`, BOM do usunięcia
  albo `header: true` z oczyszczeniem nazwy pierwszej kolumny.
