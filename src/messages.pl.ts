import type { z } from "zod"

import type { BoardErrorCode, Grade } from "./domain/board.ts"
import type { InvalidRowReason, ParsedRoster } from "./domain/csv.ts"
import type { AssignmentMode, EnrollmentPlan } from "./domain/draw.ts"
import type { AnswersCheck } from "./domain/fields.ts"
import {
  FAILED_ATTEMPTS_WINDOW_MINUTES,
  LOGIN_LINK_MINUTES,
  PASSWORD_LINK_HOURS,
} from "./domain/limits.ts"
import type { WindowCut } from "./domain/slots.ts"
import type { ExamPhase } from "./domain/schedule.ts"
import { formatDay, formatDayTime, formatSlotTime, type SlotWhen } from "./domain/time.ts"

type Failure<T> = T extends { ok: false } ? Omit<T, "ok"> : never

export type AppError =
  | Failure<EnrollmentPlan>
  | Failure<WindowCut>
  | Failure<AnswersCheck>
  | { code: BoardErrorCode }
  | { code: "SLOT_OVERLAP"; startsAt: Date; endsAt: Date }
  | { code: "MODE_CHANGED"; assignmentMode: AssignmentMode }
  | Failure<ParsedRoster>
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
        | "MAIL_UNAVAILABLE"
        | "MAIL_FAILED"
        | "LAST_FACTOR"
        | "INVALID_PASSWORD"
        | "CANNOT_CHANGE_SELF"
        | "TEACHER_NOT_FOUND"
        | "TEACHER_BANNED"
        | "ALREADY_TEACHER"
        | "LAST_TEACHER"
        | "NOT_YOUR_INDEX"
        | "EMAIL_LOGIN_UNAVAILABLE"
    }

export type Result<T = object> = ({ ok: true } & T) | ({ ok: false } & AppError)

export const LAST_FACTOR =
  "To Twój jedyny sposób potwierdzania logowania. Najpierw dodaj inny albo poproś superadmina o reset."

export const EMAIL_LOGIN_UNCONFIGURED = "Brak konfiguracji poczty (SMTP) na serwerze."

const list = (items: string[]) => items.join(", ")

/** `when`: jak pokazać chwilę slotu studentowi (godzina albo numer slotu); komunikaty prowadzącego zawsze z godzinami. */
export function errorMessage(e: AppError, when: SlotWhen = formatDayTime): string {
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
        .map((x) => `Indeks ${x.studentNumber} ma już slot: ${when(x.startsAt)}.`)
        .join(" ")
    case "SLOT_UNAVAILABLE":
      return "Ten slot jest już niedostępny: ktoś zapisał się chwilę przed Tobą albo slot już się zaczął. Wybierz inny."
    case "SLOT_OTHER_ROSTER":
      return "Ten slot jest dla innej listy niż Twoja. Zespół zalicza w terminie osoby zapisującej: wybierz slot swojej listy."
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
      return "Nie możesz zablokować siebie, odebrać sobie roli superadmina ani zresetować sobie 2FA."
    case "LAST_FACTOR":
      return LAST_FACTOR
    case "INVALID_PASSWORD":
      return "Hasło jest nieprawidłowe."
    case "MAIL_UNAVAILABLE":
      return "Zapraszanie wymaga poczty (SMTP) na serwerze."
    case "MAIL_FAILED":
      return "Konto jest, ale mail nie wyszedł: serwer poczty odrzucił wysyłkę. Wyślij link ponownie z menu konta."
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

/** `ok` z wyniku wyglądającego na `Result`, inaczej `undefined`. */
export const resultOk = (value: unknown) =>
  typeof value === "object" && value !== null && "ok" in value ? value.ok : undefined

export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? UNEXPECTED_ERROR

export const SLOT_IS_FINAL = "Slot jest przydzielony na stałe."

/** `ALREADY_ENROLLED` dla jednej osoby: to nie błąd, tylko jej slot. */
export const ownSlotMessage = (startsAt: Date, when: SlotWhen = formatDayTime) =>
  `Masz już zapis: ${when(startsAt)}. ${SLOT_IS_FINAL}`

/** Komunikat odmowy zapisu i indeksy do podświetlenia w formularzu. */
export function failureNotice(
  failure: AppError,
  studentNumbers: string[],
  when: SlotWhen = formatDayTime,
): { tone: "info" | "error"; text: string; flagged: string[] } {
  if (failure.code === "MODE_CHANGED") {
    return { tone: "info", text: errorMessage(failure), flagged: [] }
  }
  if (failure.code !== "ALREADY_ENROLLED") {
    const flagged = "studentNumbers" in failure ? failure.studentNumbers : []
    return { tone: "error", text: errorMessage(failure, when), flagged }
  }
  const [own] = failure.enrolled
  if (studentNumbers.length === 1 && own)
    return { tone: "info", text: ownSlotMessage(own.startsAt, when), flagged: [] }
  return {
    tone: "error",
    text: `${errorMessage(failure, when)} Nikogo nie zapisano.`,
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
  noRealIp: `Brak nagłówka X-Real-IP: wszyscy studenci dzielą jeden licznik limitu prób — kilka odrzuconych zgłoszeń z numerem spoza listy blokuje zapisy WSZYSTKIM na ${FAILED_ATTEMPTS_WINDOW_MINUTES} minut. Reverse proxy musi ustawiać X-Real-IP adresem klienta (README, „Przed pierwszym uruchomieniem”).`,
  unknownTimeZone: "Nieznana strefa czasowa.",
  smtpCredentials: "SMTP_USER i SMTP_PASSWORD ustawia się razem albo wcale.",
}

/** Limit długości pola tekstowego. */
export const tooLong = (max: number) => `Najwyżej ${max} znaków.`

/** Odmowy z naszych strażników Better Auth (`auth.server.ts`); klient dostaje kod. */
export const AUTH_CODE = {
  PASSKEY_ONLY: "To konto loguje się kluczem dostępu. Użyj przycisku „Zaloguj kluczem dostępu”.",
  TEACHERS_ONLY: "Ta funkcja jest tylko dla prowadzących.",
}

const AUTH_ERROR: Record<string, string> = {
  ...AUTH_CODE,
  INVALID_EMAIL_OR_PASSWORD: "Nieprawidłowy e-mail lub hasło.",
  BANNED_USER: "To konto jest zablokowane.",
  INVALID_PASSWORD: "Hasło jest nieprawidłowe.",
  PASSWORD_TOO_SHORT: "Hasło jest za krótkie.",
  PASSWORD_TOO_LONG: "Hasło jest za długie.",
  INVALID_TOKEN: "Link wygasł albo został już użyty.",
  INVALID_CODE: "Nieprawidłowy kod. Sprawdź, czy zegar telefonu jest ustawiony automatycznie.",
  INVALID_BACKUP_CODE: "Nieprawidłowy kod zapasowy.",
  INVALID_TWO_FACTOR_COOKIE: "Minęło za dużo czasu. Zaloguj się ponownie.",
  ACCOUNT_TEMPORARILY_LOCKED: "Za dużo błędnych kodów. Spróbuj ponownie za kilka minut.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Za dużo błędnych kodów. Zaloguj się ponownie.",
  SESSION_NOT_FRESH: "Zaloguj się ponownie, żeby zmienić klucze dostępu.",
  AUTH_CANCELLED: "Logowanie kluczem przerwane.",
  REGISTRATION_CANCELLED: "Dodawanie klucza przerwane.",
  PREVIOUSLY_REGISTERED: "Ten klucz jest już dodany.",
  AUTHENTICATION_FAILED: "Nie udało się zalogować tym kluczem.",
  PASSKEY_NOT_FOUND: "Ten klucz nie jest przypisany do żadnego konta.",
  FAILED_TO_VERIFY_REGISTRATION: "Nie udało się dodać klucza.",
}

export const authErrorMessage = (code: string | undefined): string =>
  (code && Object.hasOwn(AUTH_ERROR, code) && AUTH_ERROR[code]) || UNEXPECTED_ERROR

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

/** Mail z linkiem do nadania hasła: zaproszenie (konto bez hasła) albo reset. */
export function passwordMail(link: string, invited: boolean) {
  const validity = `Link jest ważny ${PASSWORD_LINK_HOURS} godziny i działa raz.`
  const [subject, lead, button, ignore] = invited
    ? [
        "Zaproszenie do Terminusa",
        `Masz konto prowadzącego w Terminusie (harmonogram zaliczeń). Ustaw hasło, a potem zabezpiecz logowanie kluczem dostępu albo aplikacją z kodami. ${validity}`,
        "Ustaw hasło",
        "",
      ]
    : [
        "Zmiana hasła w Terminusie",
        `Ktoś poprosił o link do zmiany hasła do Twojego konta. ${validity}`,
        "Ustaw nowe hasło",
        "Jeśli to nie Ty, zignoruj tę wiadomość — hasło się nie zmieni.",
      ]
  return {
    subject,
    text: [lead, link, ignore].filter(Boolean).join("\n\n"),
    html: `<p>${lead}</p><p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">${button}</a></p>${ignore ? `<p style="color:#555">${ignore}</p>` : ""}`,
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

/** Ocena na tablicy: znaczek (`short`), czytnik ekranu (`name`), eksport CSV (`csv`). */
export const GRADE: Record<Grade, { short: string; name: string; csv: string }> = {
  G2: { short: "2", name: "2", csv: "2" },
  G3: { short: "3", name: "3", csv: "3" },
  G3_5: { short: "3,5", name: "3,5", csv: "3,5" },
  G4: { short: "4", name: "4", csv: "4" },
  G4_5: { short: "4,5", name: "4,5", csv: "4,5" },
  G5: { short: "5", name: "5", csv: "5" },
  ABSENT: { short: "nieob.", name: "nieobecny", csv: "nb" },
}

export const GRADING = {
  chipEmpty: "ocena",
  chipLabel: (name: string) => `Ocena: ${name}`,
  picker: "Ocena",
  comment: "Komentarz (opcjonalny)",
  commentHint:
    "Komentarz widzą wszyscy prowadzący tego zaliczenia.",
  notGraded: "nieocenione",
  noGrade: "bez stopnia",
  previewGrade: (name: string) => `, ocena ${name}`,
  deletedAccount: "usunięte konto",
  sameForTeam: (n: number) => `Ta sama ocena dla całego zespołu (${n})`,
  counter: (graded: number, enrolled: number) => `ocenieni ${graded} / ${enrolled}`,
  confirmTitle: "Usunąć zapis z oceną?",
  confirmLead: "Ocena i komentarz znikną razem z zapisem:",
  confirm: "Usuń zapis i ocenę",
}
