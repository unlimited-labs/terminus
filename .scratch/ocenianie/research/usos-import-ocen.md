# Import ocen do protokołu USOS z pliku

Research do zadania `.scratch/ocenianie/issues/01-import-ocen-w-usos.md` (2026-10-17).

## Odpowiedź w skrócie

- **Tak.** Protokół w USOSweb (Dla pracowników → Protokoły → wybrany protokół/grupa) ma nad
  tabelą ocen opcje **„eksport ocen”** i **„import ocen”**. Import przyjmuje plik **CSV**.
  Nie ma osobnego importu XLS: plik z Excela trzeba zapisać jako CSV. [1][2][3][4][5]
- **Układ pliku jest dowolny.** Pierwszy wiersz to nagłówki kolumn, każdy następny to jeden
  student i jego oceny w poszczególnych terminach. Po wgraniu pliku prowadzący sam przypisuje
  kolumny pliku do pól protokołu i widzi podgląd. [1]
- **Student identyfikowany jest przez numer albumu (`nr_albumu`) albo `os_id`**, nigdy oba
  naraz. Imię i nazwisko nie są potrzebne do dopasowania. [1][3][4]
- **Ocena:** jedna kolumna na każdy termin protokołu (np. `termin1_ocena`), mapowana na
  „Termin 1 - ocena”, „Termin 2 - ocena” itd. [1][3][5]
- **Najpewniejszy wzorzec** to plik z „eksport ocen” z tego samego protokołu. Instrukcje
  zalecają wyeksportować, uzupełnić oceny w arkuszu i wgrać z powrotem. [1][3]
- **Instrukcja AGH istnieje**, ale jest za logowaniem SSO AGH. Nie udało się jej przeczytać,
  więc szczegóły formatu potwierdzają instrukcje innych uczelni (USOSweb jest jeden, z MUCI). [6]

## Szczegóły

### Gdzie w USOSweb

Dla pracowników → Protokoły → wyświetl/edytuj → wybór grupy albo pełnego protokołu → nad
tabelą „import ocen” → „Przeglądaj…” → PRZEŚLIJ → mapowanie kolumn → IMPORTUJ → **ZAPISZ** pod
protokołem. Import tylko wypełnia formularz: bez „ZAPISZ” oceny nie trafiają do protokołu,
a „COFNIJ ZMIANY” je odrzuca. [2][3][5]

UMCS opisuje ten sam pasek opcji: „H - eksport ocen do pliku, I - import ocen z pliku csv”. [7]
Politechnika Śląska (instrukcja OPTEAM): „umożliwia zaimportowanie ocen z odpowiednio
przygotowanego pliku csv”. [4]

### Kolumny

Uniwersytet Śląski: „Do protokołu elektronicznego zaimportować można dowolny plik o
rozszerzeniu *.CSV, w którym pierwszy wiersz zawiera nagłówki kolumn natomiast w każdym
kolejnym wierszu znajdują się dane identyfikujące studentów wraz z ocenami w poszczególnych
terminach.” oraz „konieczne jest przypisanie numeru indeksu lub identyfikatora osoby (os_id)
oraz kolumny zawierającej oceny”. [1]

UE Katowice: „Z dostępnych opcji mapowania wybieramy os_id ALBO nr_albumu (nigdy razem !!!)
oraz kolumnę ocen do zaimportowania (np. termin1_ocena).” [3]

Uniwersytet Łódzki (import z Moodle): mapuje się „kolumnę z numerem albumu” i kolumnę oceny.
Studenci spoza protokołu lub grupy zostają wypisani jako błąd z numerami albumów, a ich oceny
pomijane. [2] PW (WEiTI) opisuje to samo: błędy pomijają pojedyncze oceny, reszta wchodzi. [5]

Wniosek dla nas: wystarczą kolumny **numer albumu** + **ocena** (nagłówki dowolne, np.
`nr_albumu;ocena`). Imię i nazwisko można dodać dla czytelności, bo nie przeszkadzają
(niezmapowane kolumny są ignorowane). Uwaga: import do protokołu **grupy** odrzuci studentów
spoza tej grupy, a import do protokołu pełnego przyjmie cały przedmiot. [2][5]

### Zapis ocen

- Skala AGH (Regulamin studiów, § 13): 5.0, 4.5, 4.0, 3.5, 3.0, 2.0; dodatkowo „zal.”,
  „nzal.” (m.in. gdy student nie spełnił warunków zaliczenia), „zw. lek.” (WF). [8]
- W USOSweb oceny w protokole wybiera się z listy wartości skali przypisanej do protokołu.
  Na UMCS lista wygląda tak: `NB`, `NK`, `2`, `3`, `3,5`, `4`, `4,5`, `5`, `NZAL`, `ZAL`
  (z przecinkiem dziesiętnym). [7] UE Katowice ma ocenę negatywną z komentarzem
  „nieobecność” zamiast NB. [3] **Dostępność `NB`/`NK` zależy więc od skali danej uczelni.**
  Regulamin AGH nie wymienia „nb” ani „nk”. Dla nieobecnego najbezpieczniej zostawić pole
  puste (import go pominie) i wpisać ręcznie albo uzgodnić z dziekanatem.
- **Nie znalazłem źródła, które wprost podaje, czy import akceptuje „3,5” czy „3.5”.**
  Polskie ustawienia (lista UMCS, eksport ze Sprawdzianów) używają przecinka [7][9], więc
  domyślnie piszemy **„3,5”**. Trzeba to potwierdzić na eksporcie z prawdziwego protokołu AGH.
- PW mapuje kolumnę o nazwie `term1_wart_oc_kolejnosc` [5]. Nazwa sugeruje, że wewnętrznie
  ocena to pozycja na liście wartości, ale plik zawiera zwykły symbol oceny. Niepotwierdzone.

### Kodowanie i separator

- Protokoły: żadna instrukcja nie podaje kodowania ani separatora. UŚ każe zapisać plik w
  Excelu jako „CSV (rozdzielany przecinkami)” [1], a polski Excel zapisuje taki plik ze
  **średnikiem** i w **Windows-1250**. Podgląd w kroku mapowania od razu pokazuje, czy kolumny
  zostały rozdzielone. [1]
- Moduł Sprawdziany (inny moduł tego samego USOSweb) ma jawne ustawienia: domyślnie separator
  **średnik**, kodowanie **Windows-1250**, przecinek dziesiętny („5,5”), do wyboru inne. [9]
  Protokół najpewniej działa tak samo, ale to wnioskowanie, nie cytat.
- Numer albumu i ocena to cyfry i przecinek. Polskie znaki pojawiają się tylko w opcjonalnych
  kolumnach imienia i nazwiska, więc kodowanie wpływa wyłącznie na ich wygląd w podglądzie.

## Rekomendacja dla eksportu „pod USOS”

Osobny plik CSV: `nr_albumu;ocena` (opcjonalnie `nazwisko;imie`), separator `;`, ocena jako
`2`, `3`, `3,5`, `4`, `4,5`, `5`, puste pole dla „nieobecny” i „nie oceniono”, kodowanie
UTF-8 z BOM albo Windows-1250. Przed wdrożeniem jeden prowadzący powinien wyeksportować
prawdziwy protokół z USOSweb AGH i wgrać testowy plik do jednej grupy, bez ZAPISZ. To
potwierdzi zapis „3,5” i kodowanie.

## Źródła

1. Uniwersytet Śląski, „USOSweb: Protokoły elektroniczne - import ocen z pliku CSV”:
   https://usosweb.us.edu.pl/userfiles/file/USOSweb_import_ocen.pdf
2. Uniwersytet Łódzki, WPiA, „Import ocen do systemu UsosWeb”:
   https://www.wpia.uni.lodz.pl/fileadmin/Wydzialy/Wydzial_Prawa_i_Administracji/Strefa_Pracownika/Instrukcje/Dydaktyka/import_ocen_z_moodle_do_usosweb.pdf
3. UE Katowice, „USOSweb – instrukcja użytkownika”, rozdz. „Eksport i import ocen z Excela”:
   https://faq.ci.ue.katowice.pl/wp-content/uploads/2016/12/USOSweb-instrukcja-uzytkownika-12.09.pdf
4. Politechnika Śląska, „Protokoły przez USOSweb” (OPTEAM S.A.):
   https://www.polsl.pl/pomoc/wp-content/uploads/sites/215/2022/02/INSTR09-Protokoly_przez_USOSweb.pdf
5. PW WEiTI, „Sposób przenoszenia ocen do systemu USOS”:
   https://studia.elka.pw.edu.pl/PL/11Z/-/help/info-usos.html
6. AGH COK, „USOS dla dziekana i dydaktyka” (lista instrukcji, m.in. „Eksport listy studentów
   oraz import ocen”, akt. 08.07.2024, za SSO AGH):
   https://cok.agh.edu.pl/usos/usos-dla-dziekana-i-dydaktyka →
   https://pliki.usos.agh.edu.pl/dla-nauczycieli/USOSweb-Eksport-studentow-import-ocen.pdf
7. UMCS, „Instrukcja wprowadzania ocen do protokołów USOS”:
   https://phavi.umcs.pl/at/attachments/2016/0219/090705-instrukcja-wprowadzania-ocen-do-protokolow-usos.pdf
8. AGH, Regulamin studiów (t.j. 2023), § 13 „Skala ocen”:
   https://cok.agh.edu.pl/home/cok/Regulamin_studiow_AGH/2023_RS_t.j..pdf
9. MUCI / UE Wrocław, „USOS 4.1 – moduł Sprawdziany”, rozdz. 11 „Eksport/import danych”:
   https://usosweb.ue.wroc.pl/userfiles/file/instrukcje/sprawdziany.pdf
