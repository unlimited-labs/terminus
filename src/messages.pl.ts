import type { BoardErrorCode } from "./domain/board.ts"
import type { InvalidRowReason } from "./domain/csv.ts"
import type { EnrollmentPlan } from "./domain/draw.ts"
import type { AnswersCheck } from "./domain/fields.ts"
import type { WindowCut } from "./domain/slots.ts"
import { formatDayTime, warsawTime } from "./domain/time.ts"

type Failure<T> = T extends { ok: false } ? Omit<T, "ok"> : never

export type AppError =
  | Failure<EnrollmentPlan>
  | Failure<WindowCut>
  | Failure<AnswersCheck>
  | { code: BoardErrorCode }
  | { code: "SLOT_OVERLAP"; startsAt: Date; endsAt: Date }
  | { code: "MISSING_COLUMNS"; columns: string[] }
  | { code: "TEAM_SIZE_BELOW_EXISTING"; slots: Date[] }
  | { code: "ENTRY_EXISTS"; rosterName: string }
  | {
      code:
        | "NOT_FOUND"
        | "RATE_LIMITED"
        | "BUSY"
        | "ROSTER_REQUIRED"
        | "ROSTER_NOT_CHOSEN"
        | "IMPORT_PREVIEW_STALE"
        | "SLOT_HAS_ENROLLMENTS"
        | "ENTRY_HAS_ENROLLMENT"
        | "ROSTER_HAS_ENROLLMENTS"
        | "NAME_MISMATCH"
        | "EMAIL_TAKEN"
        | "CANNOT_CHANGE_SELF"
        | "TEACHER_NOT_FOUND"
        | "TEACHER_BANNED"
        | "ALREADY_TEACHER"
        | "LAST_TEACHER"
    }

export type Result<T = object> = ({ ok: true } & T) | ({ ok: false } & AppError)

const list = (items: string[]) => items.join(", ")

export function errorMessage(e: AppError): string {
  switch (e.code) {
    case "NO_INPUT":
      return "Wpisz numer indeksu."
    case "TEAM_TOO_LARGE":
      return `Zespół może mieć najwyżej ${e.maxTeamSize} os.`
    case "DUPLICATE_NUMBER":
      return `Ten sam indeks wpisano dwa razy: ${list(e.studentNumbers)}.`
    case "NOT_ON_ROSTER":
      return `Tego indeksu nie ma na liście zaliczenia: ${list(e.studentNumbers)}. Sprawdź numer.`
    case "ALREADY_ENROLLED":
      return e.enrolled
        .map((x) => `Indeks ${x.studentNumber} ma już slot: ${formatDayTime(x.startsAt)}.`)
        .join(" ")
    case "DIFFERENT_ROSTER":
      return `Indeks z innej listy niż reszta zespołu: ${list(e.studentNumbers)}. Zespół musi być z jednej listy.`
    case "NOT_OPEN_YET":
      return `Zapisy ruszają ${formatDayTime(e.opensAt)}.`
    case "MISSING_ANSWER":
      return `Uzupełnij: ${list(e.labels)}.`
    case "NO_FREE_SLOTS":
      return "Brak wolnych slotów. Skontaktuj się z prowadzącym."
    case "RATE_LIMITED":
      return "Za dużo nieudanych prób. Spróbuj ponownie za kilka minut."
    case "BUSY":
      return "Za dużo osób zapisuje się naraz. Spróbuj ponownie za chwilę."
    case "NOT_FOUND":
      return "Nie znaleziono."
    case "WINDOW_END_BEFORE_START":
      return "Godzina „do” musi być późniejsza niż „od”."
    case "WINDOW_TOO_SHORT":
      return "Okno jest krótsze niż jeden slot."
    case "SLOT_OVERLAP":
      return `Koliduje z istniejącym slotem ${formatDayTime(e.startsAt)}–${warsawTime(e.endsAt)}.`
    case "ROSTER_REQUIRED":
      return "Najpierw dodaj listę indeksów."
    case "IMPORT_PREVIEW_STALE":
      return "Od podglądu zmieniły się zapisy na tej liście — sprawdź podgląd jeszcze raz."
    case "ROSTER_NOT_CHOSEN":
      return "Wybierz listę."
    case "SLOT_HAS_ENROLLMENTS":
      return "Slot ma zapisy — najpierw je przenieś albo usuń."
    case "ENTRY_HAS_ENROLLMENT":
      return "Ten indeks ma zapis — najpierw go przenieś albo usuń."
    case "ROSTER_HAS_ENROLLMENTS":
      return "Na liście są indeksy z zapisem — najpierw przenieś albo usuń ich zapisy."
    case "ENTRY_EXISTS":
      return `Ten indeks jest już na liście ${e.rosterName}.`
    case "MISSING_COLUMNS":
      return `W pliku brakuje kolumn: ${list(e.columns)}. Plik odrzucony.`
    case "TEAM_SIZE_BELOW_EXISTING":
      return `Są już większe zespoły, w slotach: ${list(e.slots.map(formatDayTime))}.`
    case "NAME_MISMATCH":
      return "Wpisana nazwa nie zgadza się z nazwą zaliczenia."
    case "EMAIL_TAKEN":
      return "Ten e-mail ma już inne konto."
    case "CANNOT_CHANGE_SELF":
      return "Nie możesz zablokować siebie ani odebrać sobie roli superadmina."
    case "TEACHER_NOT_FOUND":
      return "Nie ma prowadzącego z tym adresem."
    case "TEACHER_BANNED":
      return "To konto jest zablokowane."
    case "ALREADY_TEACHER":
      return "Ta osoba już prowadzi to zaliczenie."
    case "LAST_TEACHER":
      return "Zaliczenie musi mieć co najmniej jednego prowadzącego. Zamiast tego usuń zaliczenie."
    case "SLOT_FULL":
      return "Slot jest pełny."
    case "SLOT_NOT_FOUND":
      return "Slot już nie istnieje. Odśwież stronę."
    case "PERSON_NOT_FOUND":
      return "Tej osoby już nie ma na liście. Odśwież stronę."
    case "NOT_ENROLLED":
      return "Osoba niezapisana może trafić tylko do slotu z wolnym miejscem."
    case "NO_CHANGE":
      return "Nic się nie zmieniło."
  }
}

export const UNEXPECTED_ERROR = "Coś poszło nie tak. Spróbuj ponownie."

export const SLOT_IS_FINAL = "Slot jest przydzielony na stałe."

/** `ALREADY_ENROLLED` dla jednej osoby: to nie błąd, tylko jej slot. */
export const ownSlotMessage = (startsAt: Date) =>
  `Masz już zapis: ${formatDayTime(startsAt)}. ${SLOT_IS_FINAL}`

/** Dlaczego wiersz pliku CSV nie zostanie zaimportowany (podgląd importu). */
export const INVALID_ROW: Record<InvalidRowReason | "OTHER_ROSTER", string> = {
  NOT_DIGITS: "indeks nie z samych cyfr",
  DUPLICATE_IN_FILE: "powtórzony w pliku",
  OTHER_ROSTER: "już na innej liście",
}

/** Odmowa w middleware sesji (do klienta dociera jako ogólny błąd). */
export const ACCESS_DENIED = "Brak dostępu"

/** Teksty dla administratora: logi kontenera i walidacja zmiennych środowiskowych. */
export const OPS = {
  noRealIp:
    "Brak nagłówka X-Real-IP: wszyscy studenci dzielą jeden licznik limitu prób — kilka odrzuconych zgłoszeń z numerem spoza listy blokuje zapisy WSZYSTKIM na 10 minut. Reverse proxy musi ustawiać X-Real-IP adresem klienta (README, „Przed pierwszym uruchomieniem”).",
  unknownTimeZone: "Nieznana strefa czasowa.",
}

/** Limit długości pola tekstowego. */
export const tooLong = (max: number) => `Najwyżej ${max} znaków.`

export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Nieprawidłowy e-mail lub hasło."
    case "BANNED_USER":
      return "To konto jest zablokowane."
    case "INVALID_PASSWORD":
      return "Obecne hasło jest nieprawidłowe."
    case "PASSWORD_TOO_SHORT":
      return "Hasło jest za krótkie."
    default:
      return UNEXPECTED_ERROR
  }
}
