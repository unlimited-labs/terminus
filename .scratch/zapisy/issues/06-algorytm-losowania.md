# Algorytm losowania

Type: grilling
Status: resolved
Blocked by: 04, 05

## Question

Ustalone: najpierw losowany jest dzień, potem slot w tym dniu; slot jest wolny
albo zajęty przez jeden zespół, więc wielkość zespołu nie wpływa na losowanie.
Do rozstrzygnięcia: czy w losowaniu dnia biorą udział tylko dni z co najmniej
jednym wolnym slotem; jak zapewniamy, że dwa jednoczesne zapisy nie dostaną
tego samego slotu i że ten sam indeks nie zapisze się dwa razy (transakcja,
poziom izolacji, ograniczenia unikalności, ponawianie); co widzi student,
gdy przegra wyścig o ostatni slot; skąd bierze się losowość (czy wynik ma być
odtwarzalny lub audytowalny).

## Answer

- W losowaniu dnia biorą udział tylko dni z co najmniej jednym wolnym slotem, który jeszcze się nie zaczął; każdy taki dzień z równą szansą, potem każdy taki slot w dniu z równą szansą. Sloty minione nie są losowane; prowadzący może do nich wstawić kogoś ręcznie.
- Współbieżność: każdy zapis na początku transakcji blokuje wiersz zaliczenia (`SELECT … FOR UPDATE`, domyślny `READ COMMITTED`), więc zapisy na jedno zaliczenie wykonują się po kolei. Losowanie i wstawienie zapisów dzieją się pod tą blokadą. Operacje prowadzącego na tablicy biorą tę samą blokadę. Unikalność (zaliczenie, indeks) w bazie jako ostatnia zapora. Bez pętli ponowień.
- Nikt nie przegrywa wyścigu o slot: drugi w kolejce losuje z tego, co zostało. Brak wolnych slotów → komunikat "brak wolnych slotów", bez zapisu.
- Indeks z istniejącym zapisem (także przy podwójnym kliknięciu): cały zapis odrzucony, komunikat wskazuje indeks i podaje dzień i godzinę jego slotu. Jedna reguła dla pojedynczych i zespołów. Rozstrzyga to sprzeczność punktów 3 i 5 w `SPEC.md`.
- Losowość z `crypto.randomInt`, bez ziarna, wynik nieodtwarzalny. W bazie tylko czas zapisu; zapis z losowania nie jest odróżniany od ręcznego.
- "Slot się jeszcze nie zaczął" zależy od strefy czasowej godzin slotów — rozstrzyga [Schemat bazy danych](12-schemat-bazy-danych.md).
