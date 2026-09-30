# Konta prowadzących

Type: grilling
Status: resolved
Blocked by: 02

## Question

Jak powstają i jak są zarządzane konta prowadzących? Pierwszy superadmin
z env — co dokładnie i kiedy? Jak superadmin zakłada konto (hasło tymczasowe,
wymuszona zmiana)? Reset hasła bez maili. Co dzieje się z zaliczeniami
usuniętego prowadzącego? Czy superadmin widzi cudze zaliczenia?

## Answer

- Pierwszy superadmin: przy każdym starcie kontenera skrypt czyta `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` i tworzy konto z rolą superadmina tylko wtedy, gdy tego e-maila nie ma w bazie. Istniejącego konta nie rusza; hasło z env jest tylko początkowe. Zmienne mogą zostać w env na stałe.
- Superadmin zakłada konto formularzem: e-mail, imię i nazwisko, hasło; hasło przekazuje poza aplikacją. Bez wymuszonej zmiany przy pierwszym logowaniu.
- Każdy prowadzący zmienia własne hasło na stronie swojego konta, podając obecne. E-mail i imię i nazwisko zmienia tylko superadmin.
- Reset hasła: superadmin ustawia prowadzącemu nowe hasło, wszystkie sesje tej osoby są wylogowywane.
- Utrata hasła przez superadmina bez innego superadmina: polecenie w kontenerze `docker compose exec app pnpm reset-password <email>`.
- Usuwania kont nie ma, jest blokada: zablokowany prowadzący nie zaloguje się, jego zaliczenia i linki działają dalej, blokadę można zdjąć.
- Superadmin nie widzi ani nie edytuje cudzych zaliczeń; nie ma przepisywania zaliczeń na inne konto. Zaliczenia zablokowanego prowadzącego zostają bez opiekuna — świadomie przyjęte.
- Superadmin może nadać i odebrać uprawnienie superadmina innym. Nie może odebrać go sobie ani zablokować samego siebie.
- E-mail służy tylko do logowania; nie jest weryfikowany, aplikacja nic na niego nie wysyła.
