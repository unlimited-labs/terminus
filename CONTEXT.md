# Terminus — zapisy na zaliczenia

Przydzielanie studentom losowych slotów czasowych na zaliczenia prowadzone przez wielu prowadzących.

## Language

**Zaliczenie**:
Pojedyncze wydarzenie zaliczeniowe jednego lub kilku prowadzących zaliczenia, z własną listą indeksów i własnymi slotami. Nazwa przedmiotu jest częścią jego nazwy.
_Avoid_: Egzamin, przedmiot, termin

**Slot**:
Przedział czasu w konkretnym dniu w ramach zaliczenia, należący do jednej listy indeksów i zajmowany przez jeden zespół.
_Avoid_: Termin, okienko, godzina

**Okno**:
Ciągły przedział czasu w konkretnym dniu podany przez prowadzącego, jednorazowo dzielony na sloty równej długości; po ich utworzeniu nie istnieje jako osobny byt.
_Avoid_: Zakres, blok

**Lista indeksów**:
Nazwany zbiór indeksów (z imionami i nazwiskami) uprawnionych do zapisu na dane zaliczenie, zwykle jedna grupa zajęć z systemu uczelni; zaliczenie ma jedną lub kilka list, a indeks z listy losuje tylko ze slotów tej listy.
_Avoid_: Lista studentów, grupa

**Zapis**:
Przypisanie jednego indeksu z listy indeksów do jednego slotu w ramach zaliczenia; najwyżej jeden na indeks w zaliczeniu.
_Avoid_: Rezerwacja, rejestracja

**Zespół**:
Indeksy zapisane w tym samym slocie, zaliczające razem; slot mieści dokładnie jeden zespół, a zespół jednoosobowy to zaliczenie indywidualne.
_Avoid_: Grupa, drużyna

**Odpowiedzi zespołu**:
Wartości pól zaliczenia podane przy zapisie, jedne na zespół; kto dołącza do istniejącego zespołu, przejmuje jego odpowiedzi, a przeniesiony cały zespół zachowuje swoje.
_Avoid_: Odpowiedzi studenta

**Przydział**:
Sposób, w jaki zespół dostaje slot przy zapisie; wynik jest dla studenta zawsze niezmienny (zmienia go tylko prowadzący na tablicy).
_Avoid_: Rezerwacja

**Sposób przydziału**:
Ustawienie zaliczenia, wspólne dla wszystkich jego list indeksów: **Losowanie** albo **Wybór**.
_Avoid_: Tryb zapisów

**Losowanie**:
Sposób przydziału, w którym system sam wybiera slot z wolnych slotów listy zespołu przy zapisie.
_Avoid_: Wybór terminu

**Wybór**:
Sposób przydziału, w którym student sam wskazuje wolny slot; wszystkie indeksy zespołu muszą należeć do listy tego slotu, a zajęty slot jest niedostępny (nie ma dołączania do cudzego zespołu).
_Avoid_: Rezerwacja

**Harmonogram**:
Widok wszystkich slotów zaliczenia z imionami i nazwiskami zapisanych, dostępny dla każdego, kto ma link zaliczenia (przy logowaniu mailem: po zalogowaniu).
_Avoid_: Lista zapisów, grafik

**Link zaliczenia**:
Unikalny adres, pod którym studenci zapisują się na jedno zaliczenie.

**Prowadzący**:
Osoba z kontem, która tworzy zaliczenia i zarządza tymi, których jest prowadzącym zaliczenia.
_Avoid_: Admin, wykładowca

**Prowadzący zaliczenia**:
Każde z kont przypiętych do zaliczenia; wszyscy mają równe uprawnienia (także usunięcie zaliczenia i zmianę składu), zaliczenie ma zawsze co najmniej jednego. Dodawany po e-mailu konta.
_Avoid_: Właściciel, współprowadzący (w interfejsie dopuszczalne potocznie)

**Superadmin**:
Prowadzący, który dodatkowo zarządza kontami prowadzących (zakłada, blokuje, resetuje hasła); cudzych zaliczeń nie widzi.

**Blokada konta**:
Wyłączenie logowania prowadzącego bez usuwania jego zaliczeń; kont się nie usuwa.
_Avoid_: Usunięcie konta

**Student**:
Osoba z listy zaliczenia, zapisuje się numerem albumu; przy opcji logowania mailem potwierdza się linkiem. W bazie wiersz z rolą `student`, nie konto prowadzącego.
_Avoid_: Użytkownik

**Logowanie mailem**:
Opcja zaliczenia ("Wymagaj logowania mailem"): bez zalogowania student widzi tylko ekran logowania, a po podaniu numeru albumu dostaje jednorazowy link na adres z listy zaliczenia. Dostęp wynika z tego, że adres z sesji jest na liście zaliczenia.
