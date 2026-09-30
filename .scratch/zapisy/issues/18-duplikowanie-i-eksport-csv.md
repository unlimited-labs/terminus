# Duplikowanie zaliczenia i eksport CSV

Type: grilling
Status: resolved

## Question

Co kopiuje "duplikuj zaliczenie": nazwę i ustawienia (już ustalone), a także
listy indeksów, sloty (przesunięte w czasie?) — bez zapisów? Jak wygląda
eksport do CSV: które kolumny (dzień, godzina, lista, indeks, imię,
nazwisko), sortowanie, kodowanie i separator (ten sam format co import
z uczelni — UTF-8 z BOM i `;` — żeby otwierał się w Excelu), czy eksport
obejmuje też niezapisanych?

## Answer

- "Duplikuj zaliczenie" kopiuje: nazwę z dopiskiem "(kopia)", opis, domyślną długość slotu, maksymalną wielkość zespołu oraz — przy zaznaczonym polu "Kopiuj listy indeksów" (domyślnie tak) — wszystkie listy z nazwiskami. Nie kopiuje slotów ani zapisów. Osoby, które zaliczyły, prowadzący usuwa z list kopii ręcznie.
- Eksport CSV: kolumny `data` (RRRR-MM-DD), `od`, `do`, `lista`, `indeks`, `nazwisko`, `imie`; wiersz na osobę; sortowanie po początku slotu, w slocie po nazwisku; niezapisani na końcu z pustymi kolumnami czasu; wolne sloty bez wierszy.
- Format jak import z uczelni: UTF-8 z BOM, separator `;`, pola w cudzysłowach (papaparse `unparse`). Nazwa pliku `<nazwa-zaliczenia>_<RRRR-MM-DD>.csv` (data eksportu). Eksportuje tylko właściciel zaliczenia.
