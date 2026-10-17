/** Klauzula informacyjna RODO — tekst z docs/klauzula-informacyjna.md (zaakceptowany przez IOD AGH). */
export function PrivacyNotice({ emailLogin = false }: { emailLogin?: boolean }) {
  return (
    <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer text-foreground">
        Informacja o przetwarzaniu danych osobowych
      </summary>
      <p className="mt-2">
        Realizując obowiązek informacyjny na podstawie art. 13 ust. 1 i 2 oraz art. 14 ust. 1 i 2
        Rozporządzenia Parlamentu Europejskiego i Rady (UE) nr 2016/679 z dnia 27 kwietnia 2016 r. w
        sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie
        swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (ogólne rozporządzenie
        o ochronie danych), zwanego dalej: RODO, informujemy, że:
      </p>
      <ol className="mt-2 grid list-decimal gap-1 pl-5">
        <li>
          Administratorem Pani/Pana danych osobowych jest Akademia Górniczo-Hutnicza im. Stanisława
          Staszica w Krakowie, al. A. Mickiewicza 30, 30-059 Kraków;
        </li>
        <li>
          dane kontaktowe Inspektora Ochrony Danych Osobowych dostępne są w sekcji „Kontakt” na
          stronie internetowej agh.edu.pl/uczelnia/kontakt, e-mail: iodo(at)agh.edu.pl, tel.: 12 617
          53 25;
        </li>
        <li>
          Pani/Pana dane osobowe (numer albumu, imię i nazwisko, adres e-mail, informacje wpisane w
          dodatkowych polach formularza zapisu, np. tytuł projektu, oraz ocena z zaliczenia z
          ewentualnym komentarzem prowadzącego) przetwarzane będą w celu organizacji i
          przeprowadzenia zaliczenia, w tym przydziału terminu zaliczenia, wystawienia oceny oraz
          wysłania linku potwierdzającego tożsamość przed zapisem, w ramach realizacji procesu
          kształcenia na studiach, w trybie art. 6 ust. 1 lit. c RODO, na podstawie Ustawy z dnia 20
          lipca 2018 r. Prawo o szkolnictwie wyższym i nauce; numer albumu, imię i nazwisko oraz
          adres e-mail pochodzą z listy zaliczenia przygotowanej na podstawie danych z systemu
          uczelni, informacje w dodatkowych polach podaje osoba zapisująca się, a ocenę i komentarz
          wpisuje prowadzący zaliczenie;
        </li>
        <li>
          {emailLogin
            ? "imiona i nazwiska zapisanych wraz z przydzielonymi terminami widzą wyłącznie osoby z listy zaliczenia po potwierdzeniu tożsamości; numer albumu i adres e-mail nie są ujawniane; ocenę i komentarz widzą wyłącznie prowadzący zaliczenie;"
            : "imię i nazwisko osoby zapisanej wraz z przydzielonym terminem są widoczne dla każdej osoby, która ma link do zaliczenia; numer albumu i adres e-mail nie są ujawniane; ocenę i komentarz widzą wyłącznie prowadzący zaliczenie;"}
        </li>
        <li>
          odbiorcą Pani/Pana danych osobowych mogą być podmioty uprawnione do ich uzyskania na
          podstawie przepisów prawa lub podmioty prowadzące wsparcie technologiczne dla systemów
          informatycznych, w których przetwarzane są Pani/Pana dane osobowe, w tym podmiot
          obsługujący pocztę elektroniczną aplikacji (podmiot przetwarzający), któremu adres e-mail
          jest przekazywany w celu wysłania linku;
        </li>
        <li>
          Pani/Pana dane osobowe będą przetwarzane przez okres niezbędny do organizacji i
          przeprowadzenia zaliczenia, do czasu usunięcia zaliczenia przez prowadzącego lub
          administratora aplikacji; konto i sesja osoby logującej się linkiem są usuwane
          automatycznie, najpóźniej po dobie od usunięcia jej z listy zaliczenia;
        </li>
        <li>
          posiada Pani/Pan prawo do żądania od Administratora dostępu do swoich danych oraz prawo
          ich sprostowania, prawo do przenoszenia danych, prawo ograniczenia przetwarzania danych w
          przypadkach i na warunkach określonych w RODO;
        </li>
        <li>
          przysługuje Panu/Pani prawo wniesienia skargi do organu nadzorczego – Prezesa Urzędu
          Ochrony Danych Osobowych w trybie art. 77 RODO;
        </li>
        <li>
          Pani/Pana dane osobowe nie będą podlegały profilowaniu; termin zaliczenia jest
          przydzielany losowo albo wybierany przez osobę zapisującą się, zależnie od ustawienia
          zaliczenia, i może zostać zmieniony przez prowadzącego;
        </li>
        <li>Pani/Pana dane osobowe nie będą przekazywane państwom trzecim;</li>
        <li>podanie danych osobowych jest warunkiem zapisu na zaliczenie przez tę aplikację;</li>
        <li>
          przy każdej próbie zapisu adres IP, z którego wysłano formularz, oraz wpisane numery
          albumu są zapisywane w dzienniku zdarzeń serwera w celu wyjaśniania zapisów dokonanych bez
          wiedzy zapisanej osoby; przy żądaniu linku logowania zapisywane są numer albumu i adres IP
          (bez adresu e-mail), a sesje zawierają adres IP i dane przeglądarki; dziennik ma
          ograniczony rozmiar, a najstarsze wpisy są usuwane automatycznie w miarę dopisywania
          nowych.
        </li>
      </ol>
    </details>
  )
}
