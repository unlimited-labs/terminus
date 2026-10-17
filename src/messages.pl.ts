import type { BoardErrorCode } from "./domain/board.ts"
import type { InvalidRowReason } from "./domain/csv.ts"
import type { AssignmentMode, EnrollmentPlan } from "./domain/draw.ts"
import type { AnswersCheck } from "./domain/fields.ts"
import type { WindowCut } from "./domain/slots.ts"
import type { ExamPhase } from "./domain/schedule.ts"
import { formatDay, formatDayTime, formatSlotTime } from "./domain/time.ts"

type Failure<T> = T extends { ok: false } ? Omit<T, "ok"> : never

export type AppError =
  | Failure<EnrollmentPlan>
  | Failure<WindowCut>
  | Failure<AnswersCheck>
  | { code: BoardErrorCode }
  | { code: "SLOT_OVERLAP"; startsAt: Date; endsAt: Date }
  | { code: "MODE_CHANGED"; assignmentMode: AssignmentMode }
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
        | "NOT_YOUR_INDEX"
        | "EMAIL_LOGIN_UNAVAILABLE"
    }

export type Result<T = object> = ({ ok: true } & T) | ({ ok: false } & AppError)

export const EMAIL_LOGIN_UNCONFIGURED = "Brak konfiguracji poczty (SMTP) na serwerze."

const list = (items: string[]) => items.join(", ")

export function errorMessage(e: AppError): string {
  switch (e.code) {
    case "NO_INPUT":
      return "Wpisz numer indeksu."
    case "TEAM_TOO_LARGE":
      return `Zespół może mieć najwyżej ${e.maxTeamSize} os.`
    case "DUPLICATE_NUMBER":
      return `Ten sam indeks wpisano dwa razy: ${list(e.studentNumbers)}.`
    case "EMAIL_LOGIN_UNAVAILABLE":
      return EMAIL_LOGIN_UNCONFIGURED
    case "NOT_YOUR_INDEX":
      return "Zapisu dokonuje się z własnego indeksu: w zespole musi być numer, którego adres jest przypisany do Twojego logowania."
    case "NOT_ON_ROSTER":
      return `Tego indeksu nie ma na liście zaliczenia: ${list(e.studentNumbers)}. Sprawdź numer.`
    case "ALREADY_ENROLLED":
      return e.enrolled
        .map((x) => `Indeks ${x.studentNumber} ma już slot: ${formatDayTime(x.startsAt)}.`)
        .join(" ")
    case "DIFFERENT_ROSTER":
      return `Indeks z innej listy niż reszta zespołu: ${list(e.studentNumbers)}. Zespół musi być z jednej listy.`
    case "SLOT_UNAVAILABLE":
      return "Ten slot jest już niedostępny: ktoś zapisał się chwilę przed Tobą albo slot już się zaczął. Wybierz inny."
    case "SLOT_OTHER_ROSTER":
      return "Ten slot jest dla innej listy niż Twój zespół. Wybierz slot swojej listy."
    case "MODE_CHANGED":
      return e.assignmentMode === "MANUAL"
        ? "Prowadzący zmienił sposób zapisu na ręczny. Twoje dane zostały; wybierz teraz slot z planszy."
        : "Prowadzący zmienił sposób zapisu na losowanie. Twoje dane zostały; kliknij „Losuj slot”."
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
      return `Koliduje z istniejącym slotem ${formatDay(e.startsAt)}, ${formatSlotTime(e)}.`
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

/** Komunikat odmowy zapisu i indeksy do podświetlenia w formularzu. */
export function failureNotice(
  failure: AppError,
  studentNumbers: string[],
): { tone: "info" | "error"; text: string; flagged: string[] } {
  if (failure.code === "MODE_CHANGED") {
    return { tone: "info", text: errorMessage(failure), flagged: [] }
  }
  if (failure.code !== "ALREADY_ENROLLED") {
    const flagged = "studentNumbers" in failure ? failure.studentNumbers : []
    return { tone: "error", text: errorMessage(failure), flagged }
  }
  const [own] = failure.enrolled
  if (studentNumbers.length === 1 && own)
    return { tone: "info", text: ownSlotMessage(own.startsAt), flagged: [] }
  return {
    tone: "error",
    text: `${errorMessage(failure)} Nikogo nie zapisano.`,
    flagged: studentNumbers.length > 1 ? failure.enrolled.map((e) => e.studentNumber) : [],
  }
}

/** Dlaczego wiersz pliku CSV nie zostanie zaimportowany (podgląd importu). */
export const INVALID_ROW: Record<InvalidRowReason | "OTHER_ROSTER", string> = {
  NOT_DIGITS: "indeks nie z samych cyfr",
  TOO_LONG: "za długi indeks",
  BAD_NAME: "brak albo za długie imię lub nazwisko",
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
  smtpCredentials: "SMTP_USER i SMTP_PASSWORD ustawia się razem albo wcale.",
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

export const PHASE_LABEL: Record<ExamPhase, string> = {
  draft: "Do przygotowania",
  scheduled: "Zapisy jeszcze nie ruszyły",
  open: "Zapisy trwają",
  done: "Zakończone",
}

/** Etap zaliczenia jednym zdaniem; przed zapisami z datą startu. */
export function phaseStatus(phase: ExamPhase, opensAt: Date | null): string {
  return phase === "scheduled" && opensAt
    ? `Zapisy od ${formatDayTime(opensAt)}`
    : PHASE_LABEL[phase]
}

/** Mail z linkiem logowania studenta (ważny `LOGIN_LINK_MINUTES` minut). */
export const LOGIN_LINK_MINUTES = 15

export function loginMail(link: string) {
  const subject = "Link do logowania na stronę zapisów"
  const lead = `Kliknij, żeby wejść na stronę zapisów. Link jest ważny ${LOGIN_LINK_MINUTES} minut i działa jednorazowo.`
  const ignore = "Jeśli ta wiadomość nie dotyczy Ciebie, zignoruj ją."
  return {
    subject,
    text: `${lead}

${link}

${ignore}`,
    html: `<p>${lead}</p><p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">Przejdź do zapisów</a></p><p style="color:#555">${ignore}</p>`,
  }
}

/** Ekrany logowania mailem po stronie studenta. */
export const STUDENT_LOGIN = {
  prompt: "Zaloguj się, żeby zobaczyć harmonogram.",
  unavailable: "Logowanie mailem jest chwilowo niedostępne, spróbuj później.",
  open: "Zaloguj się mailem",
  lead: "Adres z listy służy tylko do wysłania linku.",
  indexLabel: "Numer albumu",
  send: "Wyślij link",
  sentTitle: "Sprawdź skrzynkę",
  sent: (index: string) =>
    `Jeśli numer ${index} jest na liście, wysłaliśmy link (ważny ${LOGIN_LINK_MINUTES} min).`,
  resend: "Wyślij ponownie",
  resendIn: (seconds: number) => `Wyślij ponownie za ${seconds} s`,
  changeIndex: "Zmień numer",
  linkExpired: "Link wygasł lub został użyty.",
  sessionExpired: "Sesja wygasła.",
  enterTitle: "Wejdź na listę zapisów",
  enterLead: "Kliknij, żeby się zalogować.",
  enter: "Wejdź",
  logout: "Wyloguj",
}
