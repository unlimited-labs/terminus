# Moduł dostępu do zaliczenia

Type: task
Status: ready-for-agent

## Problem

Reguła „kto jest prowadzącym zaliczenia” jest w jednym miejscu (`examWhere`
w `src/server/exam-lock.server.ts`), ale:

- odczyty (`listExams`, `getExam`, `exportExamCsv`, `createExam` w `exams.ts`,
  `getSchedule` w `schedule.ts`, `listAccounts` w `accounts.ts`) pytają bazę
  wprost w funkcjach serwerowych i nie mają testów na bazie — w tym reguła
  „harmonogram bez numerów indeksów”;
- `previewImport` (`roster-ops.server.ts`) bierze `SELECT … FOR UPDATE` tylko
  dla sprawdzenia prowadzącego, a podgląd odpala się przy każdym znaku nazwy
  listy (`roster-section.tsx`) — blokuje zapisy studentów;
- `deleteBlockedAccountExam` (`account-ops.server.ts`) podstawia
  `teachers[0]` jako prowadzącego, żeby przejść przez `withExamLock`;
- kolumna `Exam.ownerId` jest zapisywana, nigdy czytana (SPEC: „do usunięcia
  w kolejnym wydaniu”), a parametr `ownerId` używa zakazanego terminu
  „Właściciel”.

## Decyzje (grilling 2026-10-08)

- Wszystkie odczyty do ops: `exams.ts` → `exam-ops.server.ts`,
  `listAccounts` → `account-ops.server.ts` (z `assertAdmin`; middleware
  `requireAdmin` zostaje), `getSchedule` → `exam-state.server.ts`. Funkcje
  serwerowe tylko walidują, sprawdzają sesję i delegują. Zwracane wartości bez
  zmian (`getExam` cudze = `null`, eksport cudzego = `NOT_FOUND`).
- `exam-lock.server.ts` → `exam-access.server.ts`. Rodzaj dostępu jako jawna
  unia (prowadzący z id / publiczny / zaliczenie samych zablokowanych kont),
  tylko w `withExamLock`, `getOwnedExam` i `removeExam`; pozostałe operacje
  przyjmują `userId: string` wywołującego konta (jak już `addTeacher`
  i `removeTeacher`, gdzie `teacherId` to usuwany prowadzący). Bez specjalnych napisów udających id.
- `deleteBlockedAccountExam` używa rodzaju dostępu „zablokowane konta” zamiast
  `teachers[0]`; warunek `orphanedExam` przenosi się do reguły dostępu.
- Parametr `ownerId` → `userId` w operacjach, `teacherId` w fixture testów.
- Kolumna `Exam.ownerId` zostaje do kolejnego wydania (README: migracje zgodne
  wstecz; wersja sprzed `exam_teachers` sprawdza dostęp przez `ownerId`, więc
  wycofanie do niej wymaga kolumny). Usunięcie (+ relacja `ExamOwner`, indeks,
  `e2e/seed.ts`, SPEC) w osobnym commicie po wdrożeniu wydania z prowadzącymi
  zaliczenia i decyzji, że wycofanie za nie nie jest już potrzebne.
- Podgląd importu: bez blokady (reguła jak `getOwnedExam`); `applyImport`
  i tak pod blokadą wykrywa `IMPORT_PREVIEW_STALE`. W UI podgląd po zmianie
  nazwy odpala się przy wyjściu z pola albo Enterze, nie przy każdym znaku.

## Testy (tests/db)

1. `listExams` zwraca tylko zaliczenia, których konto jest prowadzącym.
2. `getExam` / eksport cudzego zaliczenia → `null` / `NOT_FOUND`.
3. Harmonogram: członkowie zespołu nie mają numeru indeksu (sprawdzenie kluczy).
4. Podgląd importu kończy się, gdy inna operacja trzyma blokadę zaliczenia.
5. (istnieje) Superadmin usuwa zaliczenie samych zablokowanych kont; z aktywnym
   prowadzącym → `NOT_FOUND`.
6. `listAccounts` odmawia nie-adminowi.

## Commity (w tej kolejności)

1. `ownerId` → `userId` / `teacherId` (bez migracji). ✅
2. `exam-access.server.ts` + rodzaj dostępu „zablokowane konta”, bez `teachers[0]`. ✅
3. Odczyty do ops + testy 1–3, 6. ✅
4. Podgląd bez blokady + test 4; podgląd po wyjściu z pola nazwy.
