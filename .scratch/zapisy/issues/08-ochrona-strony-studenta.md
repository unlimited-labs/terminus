# Ochrona strony studenta

Type: grilling
Status: open
Blocked by: 02

## Question

Strona zapisu przyjmuje sam numer indeksu, bez logowania. Jak ograniczamy
nadużycia: zgadywanie indeksów po kolei, masowe zapisywanie cudzych indeksów,
podglądanie cudzych slotów? Limit prób na adres IP? Czy komunikat "indeksu nie
ma na liście" różni się od "brak miejsc"? Numer indeksu to dane osobowe — co
pokazujemy na stronie wyniku i czy potrzebna jest klauzula informacyjna?

## Comments

- Z zadania [Zapis grupowy](04-zapis-grupowy.md): harmonogram z imionami i nazwiskami jest widoczny dla każdego, kto ma link, bez wpisywania indeksu. Numery indeksów nie są pokazywane. Pytanie o dane osobowe i klauzulę informacyjną dotyczy więc teraz publicznie widocznych nazwisk.
- Z zadania [Algorytm losowania](06-algorytm-losowania.md): wpisanie indeksu, który ma już zapis, zwraca komunikat z dniem i godziną jego slotu. Kto zna cudzy indeks, pozna więc jego slot — ocenić przy limitach prób.
