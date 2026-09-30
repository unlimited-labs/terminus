# Generowanie slotów z okien

Type: grilling
Status: resolved

## Question

Prowadzący podaje okna (data + od–do), aplikacja tnie je na sloty o długości
ustawionej per zaliczenie. Co gdy okno nie dzieli się równo przez długość
slotu? Czy są przerwy między slotami? Czy prowadzący widzi podgląd i może
usunąć pojedynczy wygenerowany slot (np. na przerwę)? Czy kilka okien jednego
dnia może na siebie nachodzić? Czy sloty są zapisywane w bazie jako osobne
rekordy w chwili generowania, czy wyliczane z okien?

## Answer

- Sloty są osobnymi rekordami w bazie, tworzonymi w chwili zapisania okna. Okno jest jednorazowym narzędziem: po wygenerowaniu slotów nie istnieje w bazie, a slot nie pamięta, z którego okna pochodzi.
- Okno, które nie dzieli się równo: reszta przepada (9:00–12:00 po 25 min → 7 slotów, koniec 11:55), podgląd pokazuje liczbę niewykorzystanych minut. Okno krótsze niż jeden slot jest odrzucane.
- Przerw między slotami nie ma jako ustawienia. Przerwę robi się dwoma oknami albo usunięciem slotu.
- Formularz okna pokazuje podgląd na żywo (liczba slotów i ich godziny), bez edycji w podglądzie.
- Slot bez zapisów można usunąć pojedynczo; przy każdym dniu jest też przycisk "usuń wolne sloty". Sloty z zapisami zostają nietknięte, komunikat mówi, ile pominięto.
- Sloty jednego zaliczenia nie mogą na siebie nachodzić. Okno kolidujące z choć jednym istniejącym slotem tego dnia jest odrzucane w całości, z komunikatem wskazującym slot. Stykanie się (koniec 11:00, początek 11:00) jest dozwolone.
- Długość slotu w zaliczeniu to wartość domyślna dla formularza okna. Jej zmiana nie rusza istniejących slotów; w jednym zaliczeniu mogą być sloty różnej długości.
- Długość slotu: liczba całkowita minut, od 1 do 480. Okno mieści się w jednym dniu, "do" późniejsze niż "od". Daty z przeszłości dozwolone bez ostrzeżenia.
- Jedno wysłanie formularza to jedna data i jedno okno. Po zapisaniu formularz zostaje otwarty z tymi samymi godzinami. Wybór wielu dat naraz pominięty.
- Strefa czasowa godzin slotów: rozstrzyga zadanie [Schemat bazy danych](12-schemat-bazy-danych.md).
