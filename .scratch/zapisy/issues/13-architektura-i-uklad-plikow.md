# Architektura i układ plików

Type: grilling
Status: open
Blocked by: 01, 02, 03, 15

## Question

Jak podzielony jest kod i gdzie co leży? Układ katalogów (trasy, server
functions, logika domenowa, dostęp do bazy, komponenty UI, schematy
walidacji). Gdzie żyje logika losowania i przenoszenia zapisów, tak żeby dała
się testować bez przeglądarki i bez serwera HTTP? Gdzie sprawdzane są
uprawnienia (prowadzący widzi tylko swoje zaliczenia) — w jednym miejscu, nie
w każdej trasie. Jak dane płyną między serwerem a klientem (loadery, TanStack
Query, odświeżanie tablicy po przeciągnięciu, optymistyczne aktualizacje)?
Obsługa błędów i komunikaty po polsku. Które zalecenia z dokumentacji TanStack
Start, Prisma i Better Auth przyjmujemy jako obowiązujące? Potwierdzić, że
shadcn/ui w wariancie Base UI z Tailwind v4 instaluje się na TanStack Start
(otwarty błąd instalatora #11015).
