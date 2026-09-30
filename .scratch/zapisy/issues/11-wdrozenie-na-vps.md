# Wdrożenie na VPS

Type: grilling
Status: open
Blocked by: 01, 02, 15

## Question

Jak wygląda docker compose i konfiguracja przez env? Lista zmiennych env.
Kiedy i jak uruchamiane są migracje bazy? Kto kończy TLS (reverse proxy
w compose czy istniejący na VPS)? Kopie zapasowe bazy. Jak budowany
i dostarczany jest obraz (build na VPS czy rejestr)?

## Comments

- Z zadania [Konta prowadzących](07-konta-prowadzacych.md): przy każdym starcie, po migracjach, idempotentny skrypt tworzy pierwszego superadmina z `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`. Obraz musi też umożliwiać `docker compose exec app pnpm reset-password <email>`.
