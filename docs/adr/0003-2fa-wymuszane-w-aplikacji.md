# 2FA wymuszane w aplikacji; klucz dostępu jako pełne logowanie

Każdy prowadzący musi mieć drugi sposób potwierdzania logowania, a Better Auth
tego nie wymusza: bez skonfigurowanego 2FA hasło daje pełną sesję. Wtyczka
`passkey` jest osobną metodą logowania i omija `twoFactor`, a kody zapasowe
istnieją tylko przy TOTP. Wymóg pilnuje więc aplikacja: `sessionUser` wpuszcza
do danych tylko konto z TOTP albo z co najmniej jednym kluczem dostępu, a konto
bez tego widzi wyłącznie `/konfiguracja-2fa`. Klucz dostępu jest pełnym
logowaniem (bez hasła), a konto z samym kluczem nie loguje się hasłem
(`PASSKEY_ONLY`).

## Considered Options

- TOTP zawsze obowiązkowe, klucz dostępu tylko jako wygoda — każdy prowadzący
  musi mieć aplikację z kodami, choć klucz z PIN-em lub biometrią jest
  odporniejszy na phishing.
- Klucz dostępu jako drugi składnik po haśle — Better Auth tego nie ma, cały
  przepływ trzeba by napisać samemu.

## Consequences

- Strażników, których biblioteka nie ma, trzymamy w `auth.server.ts`: blokada
  hasła przy samym kluczu, zakaz usunięcia ostatniego sposobu (`LAST_FACTOR`),
  zakaz kluczy i TOTP dla roli `student`.
- Konto z samym kluczem nie ma kodów zapasowych; utracony klucz odblokowuje
  superadmin („Resetuj 2FA”) albo `pnpm reset-2fa`. Reset usuwa wiersze
  `twoFactor`, `passkey` i zaufane przeglądarki bezpośrednio w bazie, bo
  biblioteka nie ma do tego API.
- Do czasu konfiguracji (nowe konto, po resecie, migracja) drugi sposób może
  podpiąć każdy, kto zna hasło konta — świadomie przyjęte ryzyko.
- Klucze są przypisane do domeny z `APP_PUBLIC_URL`; zmiana domeny wymaga
  resetu 2FA wszystkich kont.
