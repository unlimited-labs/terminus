# Prisma 8 czy Prisma 7

Type: grilling
Status: resolved

## Question

Badanie pokazało, że Prisma 8 to przepisanie od zera, adapter Better Auth jej
nie obsługuje, a transakcje nie mają blokad ani poziomów izolacji poza surowym
SQL. Którą drogę wybieramy?

- (a) Prisma 8 dla tabel domenowych + Better Auth bezpośrednio na `pg`, z dwoma
  narzędziami migracji na jednej bazie i surowym SQL w losowaniu.
- (b) Prisma 7 dla wszystkiego (adapter Better Auth działa, transakcje
  z poziomem izolacji), z migracją do 8 po wydaniu stabilnym i wsparciu
  w Better Auth.
- (c) Prisma 8 i własny adapter Better Auth.

Szczegóły: [Prisma 8 z PostgreSQL](01-prisma-8-z-postgresql.md).

## Answer

Droga (b): Prisma 7 dla wszystkiego — tabel domenowych i tabel Better Auth
przez oficjalny adapter. Losowanie korzysta z transakcji z poziomem izolacji.
Przejście na Prisma 8 rozważymy po jej wydaniu stabilnym i pojawieniu się
wsparcia w Better Auth; będzie to przepisanie warstwy bazy, nie podbicie
wersji. Uzasadnienie: [ADR 0001](../../../docs/adr/0001-prisma-7-zamiast-8.md).
