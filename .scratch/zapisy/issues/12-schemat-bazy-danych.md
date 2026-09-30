# Schemat bazy danych

Type: grilling
Status: resolved
Blocked by: 01, 04, 05, 15, 16

## Question

Jak wygląda schemat Prisma: tabele, relacje, klucze, ograniczenia unikalności
i indeksy? Które reguły domeny pilnuje baza (unikalność zapisu na parę
zaliczenie–indeks, pojemność slotu, blokada usunięcia slotu z zapisami),
a które kod? Jak przechowujemy daty i godziny slotów (strefa czasowa)? Jak
tabele Better Auth łączą się z zaliczeniami? Czy grupa z zapisu grupowego ma
własną tabelę?

## Answer

- Język: w kodzie wszystko po angielsku (modele, pola, zmienne, funkcje), po polsku tylko interfejs. Nazwy: Zaliczenie `Exam`, Lista indeksów `Roster`, Dozwolony indeks `RosterEntry`, numer indeksu `studentNumber`, Slot `Slot`, Zapis `Enrollment`, Zespół `team` (bez modelu), Okno `window` (bez modelu), Losowanie `draw`, Harmonogram `schedule`, Prowadzący `User` z Better Auth (superadmin = `role: "admin"`).
- Czas slotu: `startsAt` / `endsAt` jako `timestamptz` (UTC). Prowadzący wpisuje czas polski, przeliczenie przez `@date-fns/tz`; grupowanie po dniach i wyświetlanie w `Europe/Warsaw`; "slot się zaczął" = `startsAt <= now()`.
- Link zaliczenia = `Exam.id` (UUID v4); bez osobnego, odnawialnego pola.
- Imię i nazwisko: dwa pola `firstName`, `lastName`. Numer indeksu: tekst z samych cyfr (Zod).
- Baza pilnuje: unikalności (zaliczenie, indeks) na listach i w zapisach, unikalnej nazwy listy w zaliczeniu, spójności zaliczenia przez złożone klucze obce, blokady usunięcia slotu / wpisu listy / listy z zapisem (`onDelete: NoAction`, sprawdzane na końcu polecenia). Kod pod blokadą zaliczenia pilnuje: pojemności slotu, nienachodzenia slotów, zespołu z jednej listy, końca slotu po początku.
- Usunięcie zaliczenia kaskadowo kasuje listy, wpisy, sloty i zapisy (w interfejsie wymaga wpisania nazwy zaliczenia). Usunięcie listy kasuje jej wpisy i sloty, chyba że któryś ma zapis. Konto prowadzącego: `onDelete: Restrict` (kont się nie usuwa).
- Zespół nie ma tabeli. Tabele Better Auth (`User` z polami pluginu `admin`, `Session`, `Account`, `Verification`) generuje `auth generate` do tego samego pliku schematu; wszystko w osobnej bazie danych `zapisy` (zmiana z [Architektura i układ plików](13-architektura-i-uklad-plikow.md); wcześniej schemat `zapisy`). Dokładne nazwy tabel (`@@map`) przy budowie.

Szkic przyjęty:

```prisma
model Exam {
  id                 String   @id @default(uuid())   // też link /z/<id>
  ownerId            String
  owner              User     @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  name               String
  description        String
  defaultSlotMinutes Int
  maxTeamSize        Int
  createdAt          DateTime @default(now())
}

model Roster {
  id     String @id @default(uuid())
  examId String            // Exam onDelete: Cascade
  name   String
  @@unique([examId, name])
  @@unique([id, examId])
}

model RosterEntry {
  examId        String
  studentNumber String
  rosterId      String     // [rosterId, examId] -> Roster, onDelete: Cascade
  firstName     String
  lastName      String
  @@id([examId, studentNumber])
}

model Slot {
  id       String   @id @default(uuid())
  examId   String            // [rosterId, examId] -> Roster, onDelete: Cascade
  rosterId String
  startsAt DateTime @db.Timestamptz
  endsAt   DateTime @db.Timestamptz
  @@unique([id, examId])
  @@index([examId, startsAt])
}

model Enrollment {
  examId        String
  studentNumber String   // [examId, studentNumber] -> RosterEntry, onDelete: NoAction
  slotId        String   // [slotId, examId] -> Slot, onDelete: NoAction
  createdAt     DateTime @default(now())
  @@id([examId, studentNumber])
}
```

## Comments

- Z zadania [Algorytm losowania](06-algorytm-losowania.md): zapisy serializuje blokada wiersza zaliczenia (`SELECT … FOR UPDATE`), więc pojemności slotu nie musi pilnować baza; unikalność (zaliczenie, indeks) zostaje. Losowanie pomija sloty, które już się zaczęły — strefa czasowa musi pozwolić porównać początek slotu z "teraz".
- Z zadania [Konta prowadzących](07-konta-prowadzacych.md): kont prowadzących się nie usuwa (tylko blokada), więc zaliczenie może trzymać twardy klucz obcy do użytkownika Better Auth bez kaskadowego usuwania.
- Z zadania [Grupy zajęciowe i import CSV](16-grupy-zajeciowe-i-import-csv.md): nowy byt lista indeksów (zaliczenie, nazwa); dozwolony indeks = (lista, indeks, imię i nazwisko), indeks najwyżej na jednej liście w zaliczeniu; slot należy do listy; zapis bez własnego nazwiska.
- Z zadania [Wdrożenie na VPS](11-wdrozenie-na-vps.md): baza jest wspólna z innymi aplikacjami; wszystkie tabele (także Better Auth) w schemacie PostgreSQL `zapisy`. Kontener ma `TZ=Europe/Warsaw`.
