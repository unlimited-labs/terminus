# Better Auth 1.7.18: passkey, 2FA, zaproszenia — co daje biblioteka, co piszemy sami

Stan na 2026-11-22. Notatka zbiera fakty i niczego nie rozstrzyga. Decyzje (zaproszenie mailem,
2FA obowiązkowe dla prowadzących: passkey albo hasło + TOTP, kody zapasowe, zaufane urządzenie
30 dni, bez OTP mailem, reset 2FA przez superadmina, studenci bez zmian) przyjmujemy jako dane.

## Źródła

- `B/` = `node_modules/better-auth/dist/` w wersji **1.7.18** (główny checkout; lokalny `master`
  przypina `better-auth` i `@better-auth/prisma-adapter` na 1.7.18, `origin/master` ma jeszcze 1.7.6).
- `CORE/` = `node_modules/.pnpm/@better-auth+core@1.7.18_*/node_modules/@better-auth/core/dist/`.
- `PK/` = `dist/` paczki **`@better-auth/passkey@1.7.18`** pobranej z npm (`npm pack`). Ta paczka
  **nie jest zainstalowana** w projekcie; trzeba ją dodać (`pnpm add @better-auth/passkey@1.7.18`).
  Zależności: `@simplewebauthn/server ^13.3.2`, `@simplewebauthn/browser ^13.3.0`; peer
  `better-auth ^1.7.18`, `@better-auth/core ^1.7.18`.
- Dokumentacja: https://better-auth.com/docs/plugins/passkey, https://better-auth.com/docs/plugins/2fa,
  https://better-auth.com/docs/authentication/email-password, https://better-auth.com/docs/plugins/admin.
- Dzisiejsza konfiguracja: `src/server/auth.server.ts`, `src/server/account-ops.server.ts`,
  `src/server/env.server.ts`, `prisma/schema.prisma`, `docs/adr/0002-student-jako-uzytkownik-better-auth.md`.

Gdy dokumentacja i kod się rozjeżdżają, rozstrzyga kod (zaznaczone niżej).

## 1. Passkey

**Paczka i import.** Osobna paczka, nie ma jej w `better-auth/plugins` (`B/plugins/` nie zawiera
`passkey`). Serwer: `import { passkey } from "@better-auth/passkey"`, klient:
`import { passkeyClient } from "@better-auth/passkey/client"` (docs: plugins/passkey).

**Schemat.** Jedna tabela `passkey` (`PK/index.mjs:754-801`): `name?`, `publicKey`, `userId`
(FK do `user`, indeks), `credentialID` (indeks, **bez unique**), `counter`, `deviceType`, `backedUp`,
`transports?`, `createdAt?`, `aaguid?`. W Prismie (typy z definicji pól; CLI `@better-auth/cli generate`
wygeneruje równoważny model):

```prisma
model Passkey {
  id           String    @id
  name         String?
  publicKey    String
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  credentialID String
  counter      Int
  deviceType   String
  backedUp     Boolean
  transports   String?
  createdAt    DateTime?
  aaguid       String?

  @@index([userId])
  @@index([credentialID])
  @@map("passkey")
}
```

**rpID i origin.** `rpID = options.rpID || hostname(baseURL) || "localhost"` (`PK/index.mjs:16-18`).
Oczekiwany origin bez opcji `origin` = origin `baseURL` plus origin zgłoszony przez przeglądarkę,
o ile stoi dokładnie w `trustedOrigins` (`PK/index.mjs:30-45`). Gdy `baseURL` jest ustawiony, plugin
nie patrzy na `x-forwarded-host` ani na URL żądania (`PK/index.mjs:25-26, 37-40`). U nas `baseURL =
env.APP_PUBLIC_URL`, więc:
- produkcja za reverse proxy: rpID = host z `APP_PUBLIC_URL`, origin = jego origin; nagłówki proxy
  nie mają znaczenia, byle przeglądarka otwierała dokładnie ten adres;
- lokalnie `APP_PUBLIC_URL=http://localhost:3000` daje rpID `localhost` i origin
  `http://localhost:3000`; docs: „'localhost' is okay for local dev”. Wejście przez `127.0.0.1`
  nie przejdzie weryfikacji originu.
- passkey jest związany z rpID: zmiana domeny `APP_PUBLIC_URL` unieważnia zarejestrowane klucze
  (mechanika WebAuthn, nie Better Auth).

**Czy logowanie passkeyem omija twoFactor? Tak.** `/passkey/verify-authentication` sam tworzy sesję
(`internalAdapter.createSession`) i ustawia ciasteczko (`PK/index.mjs:583-590`). Hook twoFactor działa
tylko na `/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number` (`B/plugins/two-factor/index.mjs:22-26, 303-306`).
Docs 2fa: passkey, magic link i OAuth są „not gated by 2FA by default”.

**Weryfikacja użytkownika (PIN/biometria).** Domyślnie `userVerification: "preferred"`
(`PK/index.mjs:253-258, 355`), a serwer wymaga UV tylko przy `authenticatorSelection.userVerification
=== "required"` (`PK/index.mjs:434, 566`). Bez tej opcji klucz sprzętowy bez PIN-u przejdzie jako jedyny
składnik. `residentKey` domyślnie `"preferred"` (logowanie bez podawania e-maila wymaga klucza
rezydentnego, opcja `authenticatorSelection.residentKey`).

**`emailAndPassword.disableSignUp`.** Sprawdzane wyłącznie w `/sign-up/email`
(`B/api/routes/sign-up.mjs:145`). Nie dotyczy passkeyów. Passkey i tak nie zakłada kont: rejestracja
domyślnie wymaga sesji (`registration.requireSession` domyślnie `true`, `PK/index.mjs:97-107, 160`).
Jest tryb bez sesji (`requireSession: false` + `resolveUser({ ctx, context })`,
typy `PK/index-CKK0kCyi.d.mts:80-120`), który pozwoliłby zarejestrować passkey np. z tokenu zaproszenia.

**Świeża sesja przy rejestracji.** `generate-register-options` i `verify-registration` używają
`sensitiveSessionMiddleware` + `freshSessionMiddleware` (`PK/index.mjs:163, 401`); sesja musi być
młodsza niż `session.freshAge`, domyślnie 86400 s (`B/context/create-context.mjs:149`,
`B/api/routes/session.mjs:331-343`), inaczej `SESSION_NOT_FRESH`.

**Wiele kluczy, nazwy, usuwanie.** Wiele kluczy na użytkownika: tak (rejestracja wyklucza już
zarejestrowane przez `excludeCredentials`, `PK/index.mjs:249-252`). Nazwa: `name` z body rejestracji
albo z `registration.afterVerification` (`PK/index.mjs:449-464`); bez nazwy pole zostaje puste,
pomocniczo `getAuthenticatorName(aaguid)` (`PK/index.mjs:852-858`). Endpointy (wszystkie na sesji
właściciela): `GET /passkey/list-user-passkeys` (`:616-648`), `POST /passkey/delete-passkey`
(`:665-698`, `requireResourceOwnership`), `POST /passkey/update-passkey` (zmiana nazwy, `:718-751`).
Brak endpointu „usuń passkeye innego użytkownika”.

**Inne.** Ciasteczko wyzwania `better-auth-passkey`, 300 s (`PK/index.mjs:861-868`); z prefiksem
pełna nazwa to `better-auth.better-auth-passkey` (`__Secure-` przy https, `B/cookies/index.mjs:20-40`).
Hook `authentication.afterVerification` (`PK/index.mjs:570-574`) może rzucić błąd i zablokować
logowanie. Sesja z passkeya ma zwykłą długość (bez `dontRememberMe`).

## 2. twoFactor

Import: `import { twoFactor } from "better-auth/plugins"`, klient `twoFactorClient`.

**Schemat** (`B/plugins/two-factor/schema.mjs:2-51`): pole `user.twoFactorEnabled` (boolean,
domyślnie false, `input: false`) i tabela `twoFactor`: `secret` (indeks), `backupCodes`, `userId`
(FK, indeks), `verified` (domyślnie true), `failedVerificationCount` (domyślnie 0), `lockedUntil?`.

```prisma
// w model User:
//   twoFactorEnabled Boolean? @default(false)
//   twoFactors       TwoFactor[]
model TwoFactor {
  id                      String    @id
  secret                  String
  backupCodes             String
  userId                  String
  user                    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  verified                Boolean?  @default(true)
  failedVerificationCount Int?      @default(0)
  lockedUntil             DateTime?

  @@index([secret])
  @@index([userId])
  @@map("twoFactor")
}
```

**TOTP.** 6 cyfr, okres 30 s (`B/plugins/two-factor/totp/index.mjs:35-39`). `POST /two-factor/enable`
wymaga hasła (chyba że `allowPasswordless` i brak konta `credential`, `index.mjs:163-169`,
`B/utils/password.mjs:72-76`), zapisuje sekret z `verified: false` i zwraca `totpURI` oraz kody
zapasowe (`index.mjs:182-233`). `twoFactorEnabled = true` ustawia dopiero pierwsze poprawne
`/two-factor/verify-totp` (`totp/index.mjs:171-190`), chyba że `skipVerificationOnEnable`.
Włączenie, pierwsza weryfikacja i wyłączenie rotują sesję (nowa sesja, stara usunięta).

**Kody zapasowe.** Domyślnie 10 kodów po 10 znaków w formacie `xxxxx-xxxxx`
(`backup-codes/index.mjs:14-16`, opcje `backupCodeOptions.amount`/`length`), przechowywane
zaszyfrowane (`index.mjs:59-62`). Generowane przy `enable`. Regeneracja: `POST /two-factor/generate-backup-codes`
(hasło, wymaga `twoFactorEnabled` i wiersza `twoFactor`, zastępuje stare, `backup-codes/index.mjs:256-310`).
Kod jednorazowy (`:216-233`). `auth.api.viewBackupCodes({ body: { userId } })` tylko z serwera (`:324-342`).
**Kody siedzą w wierszu `twoFactor`, który wymaga sekretu TOTP** (`secret` required). Użytkownik
z samym passkeyem nie ma kodów zapasowych z pluginu.

**Zaufane urządzenie.** `trustDevice: true` w body `verify-totp`/`verify-backup-code`; domyślnie
`trustDeviceMaxAge = 2592000` s = 30 dni (`index.mjs:57`, `types.d.mts:58-65`). Ciasteczko
`trust_device` (`constant.mjs:3`), podpisane, z HMAC `userId!identifier`; po stronie serwera wiersz
`verification` o identyfikatorze `trust-device-<losowe>` i `value = userId`
(`verify-two-factor.mjs:43-60`). Przy każdym udanym logowaniu w tym oknie rekord i ciasteczko są
wymieniane, więc 30 dni liczy się od ostatniego logowania (`index.mjs:312-325`). Dotyczy tylko
ścieżek z hasłem (pkt 1).

**Bez OTP mailem.** Nie podawać `otpOptions.sendOTP`. Wtedy `enable` z `method: "otp"` zwraca
`OTP_NOT_CONFIGURED` (`index.mjs:170`), `/two-factor/send-otp` też (`otp/index.mjs:77-84`), a w
`twoFactorMethods` nie pojawi się `"otp"` (`index.mjs:375`). Endpointy `send-otp`/`verify-otp`
dalej istnieją; można je dopisać do `disabledPaths`.

**Przebieg logowania.** `/sign-in/email` tworzy sesję, a hook `after` twoFactor, gdy
`user.twoFactorEnabled` i brak ważnego `trust_device`: kasuje ciasteczko i sesję, ustawia ciasteczko
`two_factor` (domyślnie 600 s, `twoFactorCookieMaxAge`) i zwraca
`{ twoFactorRedirect: true, twoFactorMethods: ["totp"] }` (`index.mjs:303-380`). Klient:
`twoFactorClient({ onTwoFactorRedirect })` albo `twoFactorPage` (`client.mjs:24-36`). Potem
`verify-totp` lub `verify-backup-code` tworzy właściwą sesję (`verify-two-factor.mjs:27-65`).
Limity: 5 prób na wyzwanie, blokada konta po 10 nieudanych z rzędu na 900 s
(`verify-two-factor.mjs:119-126`, `totp/index.mjs:149-150`); reguła rate limit 3 żądania / 10 s na
`/two-factor/*` (`index.mjs:389-395`).

## 3. Wymuszenie 2FA

Plugin **nie wymusza** konfiguracji. Nie ma opcji „wymagaj 2FA”; docs 2fa radzą własne hooki.
Fakty z kodu:
- Użytkownik z `twoFactorEnabled = false` dostaje po `/sign-in/email` pełną sesję (hook kończy się
  na `index.mjs:309`). Do czasu konfiguracji guard musi być po stronie aplikacji (np. `sessionUser`
  wpuszcza tylko na stronę konfiguracji).
- `twoFactorEnabled` ustawia wyłącznie TOTP/OTP; rejestracja passkeya go nie dotyka (`PK/index.mjs`
  nie aktualizuje `user`). „Skonfigurowane” trzeba więc liczyć samemu: `twoFactorEnabled` **lub**
  istnieje wiersz `passkey`.
- **Prowadzący z samym passkeyem (bez TOTP) dalej loguje się samym hasłem przez `/sign-in/email`
  i dostaje pełną sesję.** Biblioteka tego nie blokuje. Miejsca, gdzie aplikacja może to odciąć:
  `databaseHooks.session.create.before` (zna `ctx.path`, może zwrócić `false`, jak dziś dla magic
  linka), `hooks.before` na `/sign-in/email` albo guard w `sessionUser`.
- Hook `session.create.before` odpala się przy logowaniu z 2FA dwa razy: raz dla sesji z
  `/sign-in/email`, którą twoFactor zaraz usuwa, i raz dla sesji z `/two-factor/verify-*`.

## 4. Reset 2FA cudzego konta przez superadmina

Brak API. Plugin admin ma endpointy: `set-role, get-user, create-user, update-user, list-users,
list-user-sessions, unban-user, ban-user, impersonate-user, stop-impersonating, revoke-user-session(s),
remove-user, set-user-password, has-permission` (`B/plugins/admin/routes.mjs`); nic o 2FA ani passkeyach.
`/two-factor/disable` działa tylko na własnej sesji i z hasłem (`index.mjs:250-300`),
`/passkey/delete-passkey` tylko dla właściciela (`PK/index.mjs:665-698`). Reset = bezpośrednie
zapisy w bazie (to samo robi `disable`):
- `user.twoFactorEnabled = false`, usunięcie wierszy `twoFactor` i `passkey` danego `userId`;
- usunięcie wierszy `verification` z `identifier LIKE 'trust-device-%'` i `value = userId`
  (sprawdzenie zaufania wymaga tego wiersza, `index.mjs:49-51`);
- usunięcie sesji (`ctx.internalAdapter.deleteUserSessions`, jak w `replacePassword`).

## 5. Zaproszenie i ustawienie hasła

- **`createUser` bez hasła działa.** `password` jest opcjonalne (`B/plugins/admin/routes.mjs:111`);
  bez hasła nie powstaje konto `credential` (`:203-210`). Docs admina pokazują hasło jako wymagane,
  kod mówi co innego.
- **`requestPasswordReset`** wymaga `emailAndPassword.sendResetPassword`, inaczej
  `RESET_PASSWORD_DISABLED` (`B/api/routes/password.mjs:51-57`); dziś go nie mamy. Szuka użytkownika
  po e-mailu bez względu na rolę i konta (`:59`), więc działa dla użytkownika bez `credential`;
  `/reset-password` w takim wypadku **tworzy** konto `credential` (`B/utils/password.mjs:31-46`).
  `disableSignUp` tu nie gra roli (pkt 1).
- **Ważność tokenu jest globalna**: `emailAndPassword.resetPasswordTokenExpiresIn`, domyślnie 3600 s
  (`password.mjs:73`, `CORE/types/init-options.d.mts:749-753`). Nie ma parametru na wywołanie, więc
  72 h dla zaproszenia i krótszy reset nie wyjdą z jednego endpointu. `/reset-password` sprawdza
  tylko istnienie i `expiresAt` wiersza `verification` o identyfikatorze `reset-password:<token>`
  (`password.mjs:154-163`): wiersz z dłuższym `expiresAt` wstawiony przez aplikację
  (`internalAdapter.createVerificationValue`) zostałby przyjęty. To opiera się na wewnętrznym
  formacie identyfikatora, nie na publicznym API.
- **Nowe żądanie nie unieważnia poprzedniego tokenu**: każdy token to osobny wiersz
  `reset-password:<token>` (`password.mjs:74-79`), nic nie kasuje starszych. Token jest jednorazowy
  (konsumowany w transakcji, `password.mjs:161-163`).
- `revokeSessionsOnPasswordReset` domyślnie `false` (`init-options.d.mts:793`); `onPasswordReset`
  wołany po zapisie (`password.mjs:164`). `/reset-password` nie loguje.
- **Studenci**: `requestPasswordReset` znajdzie też konto studenta i po resecie da mu konto
  `credential` i logowanie hasłem. `sendResetPassword` dostaje obiekt `user` (z rolą), więc tam
  można nic nie wysłać; odpowiedź endpointu jest ta sama.
- **„Zaproszony, bez hasła”**: brak wiersza `account` z `providerId = 'credential'` przy roli innej niż
  `student` (`internalAdapter.findCredentialAccount`, `B/utils/password.mjs:49`). `/sign-in/email` bez
  konta `credential` odrzuca logowanie (`B/api/routes/sign-in.mjs:318-319`).

## 6. Współpraca z obecną konfiguracją

- **admin (ban)**: plugin admin dokłada `databaseHooks.session.create.before`, który rzuca
  `BANNED_USER` (`B/plugins/admin/admin.mjs:33-52`). Hooki pluginów wykonują się przed naszymi
  (`B/context/helpers.mjs:22-26, 43-46`), a każda ścieżka tworzy sesję przez
  `internalAdapter.createSession` → `createWithHooks` (`B/db/internal-adapter.mjs:272, 335`), więc ban
  obejmuje też passkey i `/two-factor/verify-*`.
- **magicLink**: `/magic-link/verify` nie jest w `signInPaths`, więc omija 2FA, ale nasz hook
  `session.create.before` już odrzuca sesję prowadzącego na tej ścieżce (`auth.server.ts`).
- **databaseHooks.session.create (nasz)**: dla nie-studenta zwraca `undefined` poza magic linkiem,
  więc nie przeszkadza ścieżkom `/passkey/verify-authentication`, `/two-factor/*`.
- **Studenci a nowe endpointy**: student ma sesję, więc może wywołać rejestrację passkeya
  (wymaga tylko świeżej sesji) i potem logować się passkeyem. `/two-factor/enable` go odrzuci
  (brak hasła, `allowPasswordless` domyślnie wyłączone). Blokadę passkeya dla roli `student` trzeba
  dopisać (hook, `afterVerification`).
- **disabledPaths** wyłącza tylko router HTTP (`B/api/index.mjs:168-170`); `auth.api.*` z serwera działa.
- **tanstackStartCookies** przepisuje każde `Set-Cookie` z odpowiedzi (`B/integrations/tanstack-start.mjs:23-55`),
  w tym `two_factor`, `trust_device` i ciasteczko wyzwania passkeya; musi zostać ostatnim pluginem
  (ostrzeżenie `warnIfCookiePluginNotLast`), więc `twoFactor()` i `passkey()` idą przed nim.
- **Ciasteczka** mają prefiks `better-auth.` i `__Secure-` przy `https` w `baseURL`, `httpOnly`,
  `sameSite: lax` (`B/cookies/index.mjs:20-40`).

## 7. Push 2FA

Nie ma. `B/plugins/` w 1.7.18 nie zawiera takiego pluginu, a docs 2fa wymieniają tylko OTP, TOTP i
kody zapasowe.

## Rozbieżności z przyjętymi decyzjami

1. Passkey nie ustawia `twoFactorEnabled`, a hasło samo daje pełną sesję takiemu kontu. Wariant
   „tylko passkey” wymaga własnej blokady logowania hasłem.
2. Kody zapasowe z pluginu istnieją tylko razem z TOTP. Wariant „tylko passkey” ich nie ma.
3. Wymuszenia konfiguracji 2FA nie ma w bibliotece; guard po stronie aplikacji.
4. Ważność tokenu resetu jest jedna dla całej aplikacji; 72 h zaproszenia i krótszy reset to obejście.
5. Reset 2FA przez superadmina nie ma API; zapisy w bazie.
6. Passkey domyślnie nie wymaga PIN-u/biometrii (`userVerification: "preferred"`).
