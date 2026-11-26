# Terminus

Przydzielanie studentom losowych slotów czasowych na zaliczenia prowadzone przez wielu prowadzących.

## Language

**Zaliczenie**:
Pojedyncze wydarzenie zaliczeniowe jednego lub kilku prowadzących zaliczenia, z własną listą indeksów i własnymi slotami. Nazwa przedmiotu jest częścią jego nazwy.
_Avoid_: Egzamin, przedmiot, termin

**Slot**:
Przedział czasu w konkretnym dniu w ramach zaliczenia, należący do jednej listy indeksów i zajmowany przez jeden zespół.
_Avoid_: Termin, okienko, godzina

**Numer slotu**:
Pozycja slotu wśród slotów jego dnia w zaliczeniu (od 1, po kolei w czasie, wszystkie listy indeksów razem); pokazywany zamiast godzin, gdy zaliczenie ma wyłączone pokazywanie godzin. Nie jest przechowywany: dodanie lub usunięcie wcześniejszego slotu tego dnia przesuwa numery dalszych.
_Avoid_: Kolejka, pozycja w kolejce

**Pokazywanie godzin**:
Ustawienie zaliczenia („Pokazuj godziny zaliczenia”, domyślnie włączone). Wyłączone chowa godziny slotów w widokach studenta (prowadzący dalej widzi godziny); dzień zostaje widoczny, a godziny nie są tajemnicą (ukrywa je tylko interfejs).
_Avoid_: Tryb bez godzin

**Okno**:
Ciągły przedział czasu w konkretnym dniu podany przez prowadzącego, jednorazowo dzielony na sloty równej długości; po ich utworzeniu nie istnieje jako osobny byt.
_Avoid_: Zakres, blok

**Lista indeksów**:
Nazwany zbiór indeksów (z imionami i nazwiskami) uprawnionych do zapisu na dane zaliczenie, zwykle jedna grupa zajęć z systemu uczelni; zaliczenie ma jedną lub kilka list. Zespół może łączyć indeksy z różnych list, a termin wyznacza lista zapisującego.
_Avoid_: Lista studentów, grupa

**Zapis**:
Przypisanie jednego indeksu z listy indeksów do jednego slotu w ramach zaliczenia; najwyżej jeden na indeks w zaliczeniu.
_Avoid_: Rezerwacja, rejestracja

**Zespół**:
Indeksy zapisane w tym samym slocie, zaliczające razem, także z różnych list indeksów; slot mieści dokładnie jeden zespół, a zespół jednoosobowy to zaliczenie indywidualne.
_Avoid_: Grupa, drużyna

**Odpowiedzi zespołu**:
Wartości pól zaliczenia podane przy zapisie, jedne na zespół; kto dołącza do istniejącego zespołu, przejmuje jego odpowiedzi, a przeniesiony cały zespół zachowuje swoje.
_Avoid_: Odpowiedzi studenta

**Ocena**:
Wynik zaliczenia jednego zapisanego indeksu, wystawiany przez dowolnego prowadzącego zaliczenia: stopień 2–5 albo „nieobecny”, z opcjonalnym komentarzem; brak oceny znaczy „jeszcze nie oceniono”. Należy do zapisu (idzie z nim przy przeniesieniu, znika z nim) i jest widoczna tylko dla prowadzących.
_Avoid_: Wynik, stopień (jako nazwa bytu), ocena zespołu

**Przydział**:
Sposób, w jaki zespół dostaje slot przy zapisie; wynik jest dla studenta zawsze niezmienny (zmienia go tylko prowadzący na tablicy).
_Avoid_: Rezerwacja

**Sposób przydziału**:
Ustawienie zaliczenia, wspólne dla wszystkich jego list indeksów: **Losowanie** albo **Wybór**.
_Avoid_: Tryb zapisów

**Losowanie**:
Sposób przydziału, w którym system sam wybiera slot z wolnych slotów listy zapisującego przy zapisie.
_Avoid_: Wybór terminu

**Wybór**:
Sposób przydziału, w którym student sam wskazuje wolny slot; slot musi należeć do listy zapisującego, a zajęty slot jest niedostępny (nie ma dołączania do cudzego zespołu).
_Avoid_: Rezerwacja

**Zapisujący**:
Osoba, której lista indeksów wyznacza termin zespołu: przy logowaniu mailem zalogowany student, bez niego pierwszy numer w formularzu.
_Avoid_: Lider, kapitan

**Harmonogram**:
Widok wszystkich slotów zaliczenia z imionami i nazwiskami zapisanych, dostępny dla każdego, kto ma link zaliczenia (przy logowaniu mailem: po zalogowaniu).
_Avoid_: Lista zapisów, grafik

**Kanał zmian**:
Połączenie otwartej strony studenta lub prowadzącego z serwerem, którym przychodzi sygnał „zaliczenie się zmieniło” dla jednego zaliczenia, bez żadnych danych; strona sama pobiera wtedy aktualny stan zwykłą drogą, z tymi samymi uprawnieniami.
_Avoid_: Powiadomienia, push, websocket

**Link zaliczenia**:
Unikalny adres, pod którym studenci zapisują się na jedno zaliczenie.

**Prowadzący**:
Osoba z kontem, która tworzy zaliczenia i zarządza tymi, których jest prowadzącym zaliczenia.
_Avoid_: Admin, wykładowca

**Prowadzący zaliczenia**:
Każde z kont przypiętych do zaliczenia; wszyscy mają równe uprawnienia (także usunięcie zaliczenia i zmianę składu), zaliczenie ma zawsze co najmniej jednego. Dodawany po e-mailu konta.
_Avoid_: Właściciel, współprowadzący (w interfejsie dopuszczalne potocznie)

**Superadmin**:
Prowadzący, który dodatkowo zarządza kontami prowadzących (zaprasza, blokuje, wysyła link do zmiany hasła, resetuje 2FA); cudzych zaliczeń nie widzi i nigdy nie zna cudzego hasła.

**Zaproszenie**:
Link wysłany mailem przez superadmina, którym nowy prowadzący sam nadaje sobie hasło i konfiguruje 2FA; do tego czasu konto jest „zaproszone”. Bez skonfigurowanej poczty zaproszeń nie ma.
_Avoid_: Rejestracja, założenie konta z hasłem

**2FA**:
Obowiązkowe dla każdego prowadzącego potwierdzenie logowania czymś poza hasłem: kluczem dostępu albo kodem z aplikacji (TOTP). Studentów nie dotyczy.
_Avoid_: MFA, weryfikacja dwuetapowa (w interfejsie dopuszczalne)

**Stan konta**:
Położenie konta prowadzącego na drodze do pracy w aplikacji: zaproszone (bez hasła), bez 2FA (z hasłem, bez drugiego składnika — widzi tylko konfigurację 2FA), aktywne albo zablokowane (blokada ma pierwszeństwo). Wynika z danych konta, nikt go nie ustawia ręcznie.
_Avoid_: Status konta

**Klucz dostępu**:
Passkey (FIDO2) prowadzącego — telefon, komputer albo klucz sprzętowy; logowanie nim nie wymaga hasła i samo spełnia wymóg 2FA.
_Avoid_: Passkey (w interfejsie), token sprzętowy

**Blokada konta**:
Wyłączenie logowania prowadzącego bez usuwania jego zaliczeń; kont się nie usuwa.
_Avoid_: Usunięcie konta

**Agent AI**:
Program AI (np. Claude, ChatGPT), który za zgodą prowadzącego działa w jego imieniu na jego zaliczeniach.
_Avoid_: Klient MCP, bot, integracja

**Podłączenie agenta**:
Zgoda prowadzącego dla jednego agenta AI; odłączenie ją cofa, a wszystko, co wylogowuje prowadzącego ze wszystkich sesji, także.
_Avoid_: Integracja, autoryzacja

**Student**:
Osoba z listy zaliczenia, zapisuje się numerem albumu; przy opcji logowania mailem potwierdza się linkiem. W bazie wiersz z rolą `student`, nie konto prowadzącego.
_Avoid_: Użytkownik

**Logowanie mailem**:
Opcja zaliczenia ("Wymagaj logowania mailem"): bez zalogowania student widzi tylko ekran logowania, a po podaniu numeru albumu dostaje jednorazowy link na adres z listy zaliczenia. Dostęp wynika z tego, że adres z sesji jest na liście zaliczenia.
