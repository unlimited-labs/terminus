# Prisma 7 zamiast Prisma 8

Pierwotnie wybraliśmy Prisma 8 mimo statusu RC. Badanie z 2026-09-30 pokazało,
że adapter Prisma w Better Auth obsługuje tylko wersje 5–7 (wsparcie dla 8
odłożone do wydania stabilnego), a transakcje w Prisma 8 nie mają blokad
wierszy ani poziomów izolacji poza surowym SQL. Używamy więc Prisma 7 dla
całej bazy, łącznie z tabelami Better Auth.

## Considered Options

- Prisma 8 + Better Auth bezpośrednio na `pg` — dwa narzędzia migracji na
  jednej bazie i surowy SQL w losowaniu.
- Prisma 8 + własny adapter Better Auth — najwięcej własnego kodu.

## Consequences

Prisma 8 to przepisanie od zera (inny schemat, klient i migracje), więc
późniejsze przejście oznacza przepisanie warstwy dostępu do bazy. Dostęp do
bazy trzymamy w jednym miejscu, żeby to przejście było tanie.
