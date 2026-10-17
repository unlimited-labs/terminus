# Student jako użytkownik Better Auth

Logowanie studenta linkiem na maila (opcja zaliczenia) potrzebuje tokenów,
sesji i wysyłki, a Better Auth ma to w wtyczce `magicLink` i trzyma na tabelach
użytkowników. Student to więc wiersz `user` z rolą `student`, zakładany przy
pierwszym zweryfikowanym linku, bez hasła i bez konta `credential`. Dostęp do
zaliczenia liczymy przy każdym żądaniu z listy: adres z sesji musi należeć do
wpisu listy tego zaliczenia, więc w sesji nie ma zaliczenia ani indeksu.

## Considered Options

- Osobna tabela studentów z własnymi tokenami i sesjami — pełna separacja od
  kont prowadzących, ale własny kod tokenów, wygasania, ciasteczek i limitów.

## Consequences

- Każdy guard prowadzącego odrzuca rolę `student` (`sessionUser` jej nie zwraca,
  więc `requireUser` i `requireAdmin` też), a lista kont w panelu jej nie pokazuje.
- Link potwierdza tylko własność skrzynki, a Better Auth przy użytkowniku bez
  zweryfikowanego adresu kasuje jego konta i sesje. Dlatego prowadzący mają
  `emailVerified = true`, a `requestLink` nie wysyła nic na adres istniejącego
  konta prowadzącego.
- Sesja studenta trwa 24 h, bez odnawiania i bez `Max-Age`.
- Konta studentów sprząta zadanie Nitro `student:cleanup` (raz na dobę).
