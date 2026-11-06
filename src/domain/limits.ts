/** Limity i stałe wspólne dla klienta i serwera (osobny plik, bez papaparse w paczce klienta). */
export const STUDENT_NUMBER_MAX = 20
export const STUDENT_NUMBER_PATTERN = /^\d+$/
export const TEAM_SIZE_MAX = 20
export const SLOT_MINUTES_MAX = 480
export const EXAM_FIELDS_MAX = 5
export const PERSON_NAME_MAX = 100
export const ROSTER_NAME_MAX = 50
export const EMAIL_MAX = 254
export const GRADE_COMMENT_MAX = 500
/** Ważność linku logowania studenta. */
export const LOGIN_LINK_MINUTES = 15
/** Okno licznika nieudanych prób zapisu (blokada IP). */
export const FAILED_ATTEMPTS_WINDOW_MINUTES = 10
