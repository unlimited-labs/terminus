import type { BoardErrorCode } from "./domain/board.ts"
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
        | "SLOT_HAS_ENROLLMENTS"
        | "ENTRY_HAS_ENROLLMENT"
        | "ROSTER_HAS_ENROLLMENTS"
        | "NAME_MISMATCH"
        | "EMAIL_TAKEN"
        | "CANNOT_CHANGE_SELF"
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
      return `Indeks z innej grupy niż reszta zespołu: ${list(e.studentNumbers)}. Zespół musi być z jednej listy.`
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
