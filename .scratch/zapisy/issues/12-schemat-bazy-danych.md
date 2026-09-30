# Schemat bazy danych

Type: grilling
Status: open
Blocked by: 01, 04, 05, 15, 16

## Question

Jak wygląda schemat Prisma: tabele, relacje, klucze, ograniczenia unikalności
i indeksy? Które reguły domeny pilnuje baza (unikalność zapisu na parę
zaliczenie–indeks, pojemność slotu, blokada usunięcia slotu z zapisami),
a które kod? Jak przechowujemy daty i godziny slotów (strefa czasowa)? Jak
tabele Better Auth łączą się z zaliczeniami? Czy grupa z zapisu grupowego ma
własną tabelę?

## Comments

- Z zadania [Algorytm losowania](06-algorytm-losowania.md): zapisy serializuje blokada wiersza zaliczenia (`SELECT … FOR UPDATE`), więc pojemności slotu nie musi pilnować baza; unikalność (zaliczenie, indeks) zostaje. Losowanie pomija sloty, które już się zaczęły — strefa czasowa musi pozwolić porównać początek slotu z "teraz".
- Z zadania [Konta prowadzących](07-konta-prowadzacych.md): kont prowadzących się nie usuwa (tylko blokada), więc zaliczenie może trzymać twardy klucz obcy do użytkownika Better Auth bez kaskadowego usuwania.
- Z zadania [Grupy zajęciowe i import CSV](16-grupy-zajeciowe-i-import-csv.md): nowy byt lista indeksów (zaliczenie, nazwa); dozwolony indeks = (lista, indeks, imię i nazwisko), indeks najwyżej na jednej liście w zaliczeniu; slot należy do listy; zapis bez własnego nazwiska.
