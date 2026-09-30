# Strona studenta

Type: prototype
Status: resolved
Blocked by: 04, 08

## Question

Jak wygląda i zachowuje się strona pod linkiem zaliczenia: publiczny
harmonogram (wszystkie sloty, imiona i nazwiska zapisanych, bez indeksów),
formularz zapisu zespołu (indeks + imię i nazwisko dla każdego członka, od 1
do maksimum), moment losowania, ekran wyniku, ponowne wejście, stany błędów
(indeks spoza listy, indeks już zapisany, brak wolnych slotów)? Prototyp ze
skillem `/frontend-design`.

## Assets

- Prototyp (3 warianty, 9 scenariuszy): [prototypes/strona-studenta.html](../prototypes/strona-studenta.html)

## Answer

Wybrany wariant B prototypu ("Plansza + wysuwany formularz"). Warianty A (formularz na górze, harmonogram jako lista) i C (zakładki i kroki) odrzucone; A był wybrany na chwilę i zmieniony na B.

- Strona to harmonogram jako plansza: nagłówek (nazwa zaliczenia, miejsce, prowadzący), legenda (wolny, zajęty, Twój), pod spodem siatka: dni jako kolumny, sloty jako kafelki z godziną początku i nazwiskiem pierwszej osoby zespołu z dopiskiem "+n"; wolny kafelek opisany "wolny".
- Dotknięcie (kliknięcie) zajętego kafelka rozwija go w miejscu i pokazuje pełny skład zespołu (imiona i nazwiska). Wolny kafelek nie reaguje.
- Kolumny mają stałą szerokość; gdy dni nie mieszczą się na ekranie, plansza przewija się w poziomie, a na starcie widoczny jest pierwszy dzień z wolnym slotem.
- Minione sloty wyglądają jak pozostałe (bez kreskowania); pusty miniony slot nie jest opisany jako "wolny", bo nie da się go wylosować.
- Formularz w panelu wysuwanym z dołu po przycisku "Zapisz się" przypiętym na dole ekranu. W panelu: dla każdej osoby numer indeksu i imię i nazwisko, "Dodaj osobę do zespołu (n/maks.)" do maksymalnej wielkości zespołu, "Usuń" przy dodanej osobie, jeden przycisk "Losuj slot", pod spodem zwinięta klauzula RODO. Przy zaliczeniu indywidualnym bez wzmianek o zespole.
- Po wysłaniu krótki stan "Losowanie slotu…" w panelu, potem w panelu "bilet": dzień, godzina, miejsce, skład zespołu z imionami i nazwiskami i numerami indeksów, zdanie, że slot jest przydzielony na stałe. Przycisk "Pokaż na planszy" zamyka panel; kafelek z wynikiem jest wyróżniony i krótko pulsuje, a przycisk na dole zmienia się na "Twój slot".
- Komunikaty w panelu nad polami, pole z problematycznym indeksem podświetlone. "Indeks ma już zapis" przy jednej osobie to informacja (zielona) z dniem i godziną slotu; przy zespole błąd (czerwony) z tym samym slotem i zdaniem, że nikogo nie zapisano. Pozostałe błędy czerwone: indeksu nie ma na liście, brak wolnych slotów, limit prób, brak danych, ten sam indeks wpisany dwa razy.
- Brak wolnych slotów już przy wejściu: komunikat nad planszą, bez przycisku "Zapisz się".
- Ponowne wejście nie ma osobnego ekranu: student wpisuje indeks jeszcze raz i dostaje "ma już zapis" ze swoim slotem.
- Kolory i kroje z prototypu nie są decyzją; kierunek wizualny zostaje otwarty na mapie.
