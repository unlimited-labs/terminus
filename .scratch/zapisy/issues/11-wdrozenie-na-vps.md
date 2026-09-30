# Wdrożenie na VPS

Type: grilling
Status: resolved
Blocked by: 01, 02, 15

## Question

Jak wygląda docker compose i konfiguracja przez env? Lista zmiennych env.
Kiedy i jak uruchamiane są migracje bazy? Kto kończy TLS (reverse proxy
w compose czy istniejący na VPS)? Kopie zapasowe bazy. Jak budowany
i dostarczany jest obraz (build na VPS czy rejestr)?

## Answer

- Na VPS działają już: NPMplus (reverse proxy z certyfikatami SSL) i osobny kontener PostgreSQL wspólny dla wielu aplikacji. `compose.yaml` aplikacji zawiera tylko kontener aplikacji — bez proxy, bez bazy, bez kopii zapasowych.
- Baza: ~~wspólna baza, schemat `zapisy`~~ — zmienione w [Architektura i układ plików](13-architektura-i-uklad-plikow.md): osobna baza danych `zapisy` z własnym użytkownikiem w istniejącym, wspólnym kontenerze PostgreSQL; tabele w `public` tej bazy (Prisma 7 z `@prisma/adapter-pg` ignoruje `?schema=`). Założenie bazy i użytkownika raz ręcznie, SQL w README. Prisma 7 obsługuje PostgreSQL 9.6–18.
- Kopie zapasowe bazy: poza zakresem aplikacji (świadomie pominięte; odpowiada za nie właściciel wspólnej bazy).
- Sieć: aplikacja nie wystawia portów; dołącza do zewnętrznej sieci Dockera z NPMplus i bazą; NPMplus łączy się z nią po nazwie kontenera. Nazwy sieci w `compose.yaml` na VPS.
- IP klienta tylko z nagłówka `X-Real-IP` ustawianego przez NPMplus (Better Auth: `advanced.ipAddress.ipAddressHeaders: ["x-real-ip"]`; ten sam nagłówek dla limitu prób na stronie studenta). Przy wdrożeniu sprawdzić, że NPMplus nadpisuje ten nagłówek.
- Obraz: budowany lokalnie `docker buildx build --platform linux/amd64 --push`, wysyłany do prywatnego rejestru `registry:2`. Tag = wersja z gita (np. `zapisy:1.4.0`), bez `latest`. VPS pobiera obraz po `IMAGE_TAG` z `.env`; wycofanie = poprzedni tag + `docker compose up -d`.
- Na VPS tylko `compose.yaml` i `.env`; VPS nie potrzebuje dostępu do repozytorium.
- Start kontenera: `prisma migrate deploy` → skrypt pierwszego superadmina → serwer (`node .output/server/index.mjs`). Obraz zawiera CLI Prisma i skrypty (`reset-password`), więc jest większy niż samo `.output`.
- Zmienne env (t3-env, brak = aplikacja nie startuje), plik `.env` na VPS poza repo, `.env.example` w repo: `IMAGE_TAG`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `PORT` (domyślnie 3000), `TZ` (`Europe/Warsaw`).

## Comments

- Z zadania [Konta prowadzących](07-konta-prowadzacych.md): przy każdym starcie, po migracjach, idempotentny skrypt tworzy pierwszego superadmina z `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`. Obraz musi też umożliwiać `docker compose exec app pnpm reset-password <email>`.
- Z zadania [Ochrona strony studenta](08-ochrona-strony-studenta.md): limit prób w aplikacji potrzebuje prawdziwego IP klienta. Reverse proxy musi ustawiać (nadpisywać) nagłówek z IP, a aplikacja i Better Auth mają ufać tylko jemu.
