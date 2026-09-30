# Tablica zapisów prowadzącego

Type: prototype
Status: resolved
Blocked by: 03, 04, 05

## Question

Jak wygląda i zachowuje się tablica zapisów: sloty pogrupowane po dniach,
w slocie zespół złożony z kafelków (indeks + imię i nazwisko), kolumna
"niezapisani"; przeciąganie całego zespołu (przeniesienie, zamiana dwóch
zespołów) i pojedynczej osoby (do innego zespołu, do "niezapisanych",
ręczny zapis z podaniem nazwiska), edycja nazwiska, obsługa z klawiatury, zachowanie
przy kilkudziesięciu slotach i ponad stu indeksach? Prototyp ze skillem
`/frontend-design` na bibliotece wybranej w zadaniu o przeciąganiu.

## Assets

- Prototyp (3 warianty, `@dnd-kit/react` 0.5.0): [prototypes/tablica-prowadzacego.html](../prototypes/tablica-prowadzacego.html)

## Answer

Wybrany wariant C prototypu ("Tabela"), bez list "Przenieś do…" — wszystkie operacje przeciąganiem. Warianty A (kolumny dni) i B (wiersze dni z tacą na dole) odrzucone.

- Układ: po lewej przyklejony panel "Niezapisani" (liczba, wyszukiwarka indeksu, kafelki z samym numerem), po prawej tabela slotów: wiersz = slot, kolumny: dzień (tylko w pierwszym wierszu dnia, dni oddzielone grubszą linią), godzina, zespół jako kafelki w jednej linii (albo "wolny").
- Nad tabelą: nazwa zaliczenia, liczby (zapisani / wszystkie indeksy, wolne sloty, miejsca łącznie), ostrzeżenie, gdy miejsc jest mniej niż indeksów, wyszukiwarka "Znajdź indeks albo nazwisko" podświetlająca pasujące kafelki.
- Kafelek osoby: imię i nazwisko, numer indeksu, przycisk ✎ do edycji imienia i nazwiska w miejscu (Enter zapisuje, Esc anuluje).
- Przeciąganie osoby: na slot z wolnym miejscem → przeniesienie; na inną osobę → zamiana slotów tych dwóch osób; na pełny slot → odrzucone z komunikatem (podświetlenie na czerwono w trakcie); na "Niezapisani" → usunięcie zapisu.
- Z "Niezapisanych" na slot z wolnym miejscem → okno ręcznego zapisu z polem imię i nazwisko (wymagane). Na osobę — odrzucone.
- Cały zespół: uchwyt w wierszu slotu (do dodania — w prototypie C go nie było). Upuszczenie na wolny slot → przeniesienie; na slot z innym zespołem → zamiana zespołów.
- Każda operacja kończy się komunikatem u dołu z przyciskiem "Cofnij" (kilka sekund); bez okien potwierdzenia.
- Klawiatura: domyślny KeyboardSensor dnd-kit (Tab do kafelka, Spacja podnosi, strzałki przesuwają, Spacja upuszcza, Esc anuluje). Sprawdzone w prototypie: przeniesienie klawiaturą przechodzi przez `onDragEnd`. Ruch jest o piksele (10 px, z Shift 50 px), więc odległy slot wymaga wielu naciśnięć — świadomie przyjęte po odrzuceniu list "Przenieś do…". Komunikaty dla czytnika ekranu trzeba podmienić na polskie (`Accessibility.configure()`).
- Potwierdzone w prototypie (`@dnd-kit/react` 0.5.0): `useDraggable` i `useDroppable` na tym samym elemencie działają (kafelek jako źródło i cel zamiany; slot jako cel i źródło zespołu z uchwytem `handleRef`). Zamiana i limit pojemności to własny kod w `onDragEnd`; tę samą regułę sprawdza serwer.
- Przeciąganie myszą nie zostało sprawdzone automatycznie (syntetyczne zdarzenia nie uruchomiły czujnika wskaźnika); do sprawdzenia ręcznie przy budowie.
- Kolory i kroje z prototypu nie są decyzją.

## Comments

- Wymaganie grup zajęciowych ([Grupy zajęciowe i import CSV](16-grupy-zajeciowe-i-import-csv.md)) doszło w trakcie. Prototyp go nie uwzględnia; reguły przenoszenia między slotami różnych grup rozstrzyga tamto zadanie.
- Zmienione przez [Grupy zajęciowe i import CSV](16-grupy-zajeciowe-i-import-csv.md): ręczny zapis nie pyta o nazwisko (bierze je z listy), edycja nazwiska zmienia wpis na liście; kolumna "Lista", "Niezapisani" podzieleni na listy, przenoszenie między listami bez ostrzeżenia.
