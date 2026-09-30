# Ochrona strony studenta

Type: grilling
Status: resolved
Blocked by: 02

## Question

Strona zapisu przyjmuje sam numer indeksu, bez logowania. Jak ograniczamy
nadużycia: zgadywanie indeksów po kolei, masowe zapisywanie cudzych indeksów,
podglądanie cudzych slotów? Limit prób na adres IP? Czy komunikat "indeksu nie
ma na liście" różni się od "brak miejsc"? Numer indeksu to dane osobowe — co
pokazujemy na stronie wyniku i czy potrzebna jest klauzula informacyjna?

## Answer

- Limit prób liczy tylko nieudane próby "indeksu nie ma na liście": 10 na 10 minut z jednego IP. Udane zapisy i "indeks ma już zapis" się nie liczą, żeby nie blokować wielu studentów za jednym adresem uczelnianej sieci. Limit w aplikacji (`rate-limiter-flexible`, magazyn w pamięci; po restarcie liczniki się zerują), klucz = IP klienta z nagłówka ustawianego przez reverse proxy.
- Masowego zapisywania prawdziwych cudzych indeksów limit nie zatrzymuje — świadomie przyjęte ryzyko, jak w `SPEC.md`.
- Trzy różne komunikaty: indeksu nie ma na liście, indeks ma już zapis (z dniem i godziną slotu), brak wolnych slotów.
- Bez CAPTCHA.
- Strony `/z/…` mają `noindex` i nie mają podglądu linku z nazwiskami.
- Klauzula informacyjna: stały tekst pod formularzem, wpisany w kod, oparty na klauzuli AGH dla studentów — [docs/klauzula-informacyjna.md](../../../docs/klauzula-informacyjna.md). Szkic wymaga akceptacji Inspektora Ochrony Danych AGH przed uruchomieniem.
- Dane nie znikają automatycznie; usuwa je prowadzący, kasując zaliczenie.

## Comments

- Z zadania [Zapis grupowy](04-zapis-grupowy.md): harmonogram z imionami i nazwiskami jest widoczny dla każdego, kto ma link, bez wpisywania indeksu. Numery indeksów nie są pokazywane. Pytanie o dane osobowe i klauzulę informacyjną dotyczy więc teraz publicznie widocznych nazwisk.
- Z zadania [Algorytm losowania](06-algorytm-losowania.md): wpisanie indeksu, który ma już zapis, zwraca komunikat z dniem i godziną jego slotu. Kto zna cudzy indeks, pozna więc jego slot — ocenić przy limitach prób.
