# Prisma 8 z PostgreSQL

Type: research
Status: claimed

## Question

Jaki jest aktualny stan Prisma 8 (wydanie niestabilne) i jak jej użyć w tym
projekcie? Konkretnie: jak wygląda konfiguracja z PostgreSQL (generator,
driver adapter, plik konfiguracyjny), co zmieniło się względem Prisma 7, jak
uruchamiać migracje w kontenerze Docker przy starcie, jak robić transakcje
z blokadą wiersza lub poziomem izolacji (potrzebne do losowania slotu bez
przepełnienia), oraz czy adapter Prisma w Better Auth działa z Prisma 8.
Znane błędy i obejścia.
