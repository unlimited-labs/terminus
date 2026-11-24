# Better Auth jako serwer autoryzacji MCP

Stan na 2026-11-24. Repo: `better-auth` 1.7.18 (package.json:39). Źródła: paczki npm `@better-auth/mcp`,
`@better-auth/oauth-provider`, `@better-auth/cimd` w wersji 1.7.18 (pobrane `npm pack`, czytany `dist/`),
kod na tagu [v1.7.18](https://github.com/better-auth/better-auth/tree/v1.7.18), notatki wydania
[v1.7.0](https://github.com/better-auth/better-auth/releases/tag/v1.7.0), dokumentacja
[plugins/mcp](https://www.better-auth.com/docs/plugins/mcp) i
[plugins/oauth-provider](https://www.better-auth.com/docs/plugins/oauth-provider).

## Odpowiedź w skrócie

- Jest: **`@better-auth/mcp`** (osobna paczka, wersje zsynchronizowane z rdzeniem, `latest` = 1.7.28,
  `beta` = 1.8.0-beta.11). To `oauthProvider()` skonfigurowany pod MCP: OAuth 2.1, PKCE, RFC 8707
  (`resource`), RFC 9728 (metadane zasobu), RFC 8414, DPoP, rotacja refresh tokenów.
- W 1.7.0 (breaking) wtyczkę `mcp` wyjęto z rdzenia do `@better-auth/mcp`, a przestarzały `oidcProvider`
  **usunięto** (następca: `@better-auth/oauth-provider`). W zainstalowanym `better-auth` 1.7.18 nie ma
  już `plugins/mcp` ani `plugins/oidc-provider` (sprawdzone w `node_modules/better-auth/package.json`
  exports). Żadnej z trzech paczek (`mcp`, `oauth-provider`, `cimd`) nie ma dziś w repo.
- Status: dokumentacja nie oznacza ich jako beta/deprecated; to zalecana droga. Dokumentacja i kod
  celują w **MCP 2026-07-28** (README `@better-auth/mcp`). Najświeższe zmiany idą szybko
  (1.7.0 łamało schemat i opcje), więc przypinamy wersję dokładnie jak resztę Better Auth.
- Wymagane razem: `jwt()` z `better-auth/plugins` (podpis tokenów, `/jwks`), zalecane `cimd()`
  z `@better-auth/cimd`. `mcp()` zastępuje `oauthProvider()` — nie wolno dodać obu.

## Konfiguracja (z README/JSDoc `@better-auth/mcp` 1.7.18)

```ts
plugins: [
  jwt({ disableSettingJwtHeader: true }),          // + "/token" w disabledPaths (zalecenie docs)
  mcp({ loginPage: "/login", consentPage: "/zgoda", resource: "https://<host>/mcp" }),
  cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
]
```

- `resource` musi być HTTPS bez query/fragmentu (http tylko na loopbacku) — `validateMcpResource`
  w [packages/mcp/src/handler.ts](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/mcp/src/handler.ts).
- `mcp()` dopisuje `resource` do `resources` i `clientRegistrationDefaultResources`, ustawia
  `refreshTokenReuseInterval` = 30 s (docs zalecają `0`, jeśli klienci nie gubią odpowiedzi)
  — [packages/mcp/src/plugin.ts](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/mcp/src/plugin.ts).

## Metadane `.well-known`

- Issuer = `jwt.issuer` albo `baseURL` Better Auth, czyli u nas `https://<host>/api/auth`.
  Metadane AS są więc pod `/.well-known/oauth-authorization-server/api/auth` (RFC 8414, wstawka ścieżki)
  oraz `/api/auth/.well-known/oauth-authorization-server`; `/.well-known/openid-configuration` tylko gdy
  `scopes` zawiera `openid` (domyślnie tak). Kod: `handleIssuerMetadataRequest` w
  [authorize.ts / oauth.ts](https://github.com/better-auth/better-auth/tree/v1.7.18/packages/oauth-provider/src).
- `mcp()` serwuje RFC 9728 pod `/.well-known/oauth-protected-resource` i
  `/.well-known/oauth-protected-resource/mcp`, ale **tylko gdy żądanie trafi do `auth.handler`**.
  U nas `auth.handler` dostaje wyłącznie `/api/auth/*` (src/routes/api/auth/$.ts:8-9), więc trzeba
  dodać trasy serwerowe TanStack Start pod ścieżkami `/.well-known/...` przekazujące do
  `auth.handler(request)` albo użyć eksportów `oauthProviderAuthServerMetadata(auth)` /
  `oauthProviderOpenIdConfigMetadata(auth)` z `@better-auth/oauth-provider`. Docs to potwierdzają
  („Most frameworks forward only your auth base path… you need extra routes”).
- Alternatywa: `jwt({ jwt: { issuer: "https://<host>" } })` (issuer bez ścieżki) — mniej dziwne URL-e,
  ale trasy w root i tak są potrzebne. Do rozstrzygnięcia przy specyfikacji.

## Rejestracja klienta

- DCR (`/oauth2/register`, RFC 7591) **domyślnie wyłączona** od 1.7.0. Włączenie dla anonimowych klientów
  wymaga `allowDynamicClientRegistration` + `allowUnauthenticatedClientRegistration` (każdy może
  zarejestrować klienta). `registration_endpoint` znika z metadanych, gdy DCR wyłączone.
- CIMD (`client_id` = URL dokumentu JSON klienta) przez `@better-auth/cimd`: serwer pobiera dokument
  klienta, więc aplikacja wychodzi do internetu. Wymagany transport z ochroną SSRF — gotowy
  `fetchClientMetadataResource` z `@better-auth/cimd/node`. Opcje: `isMetadataDocumentUrlAllowed`
  (lista dozwolonych hostów, np. tylko claude.ai/anthropic.com), limity pobrań, `onClientCreated` (audyt).
- `clientRegistrationDefaultApplicationType: "infer"` istnieje wprost dla natywnych klientów MCP
  z `http://127.0.0.1` (JSDoc wymienia Cursor i starsze Claude Code).
- **Nie potwierdzone tutaj:** czy Claude.ai / Claude Code w wersji z 2026-11 używa CIMD, czy jeszcze DCR.
  To pytanie do ticketu 01 (specyfikacja) — od tego zależy, czy wystarczy samo `cimd()`.

## Ekran zgody, logowanie

- Przepływ: `/oauth2/authorize` → brak sesji ⇒ `loginPage?<podpisane zapytanie>`; jest sesja i brak zgody
  ⇒ `consentPage?...`; strona zgody woła `authClient.oauth2.consent({ accept })`. Zgoda zapisywana
  w `oauthConsent` (per klient + użytkownik), kolejne autoryzacje bez ekranu, chyba że `prompt=consent`.
- Kontynuacja po logowaniu: klientowa wtyczka `oauthProviderClient()` (z
  `@better-auth/oauth-provider/client`) dokleja `oauth_query` (tylko gdy w URL jest `sig`) do każdego
  POST-a klienta. Hook `after` wtyczki: gdy odpowiedź ustawia ciasteczko sesji, a w żądaniu był
  `oauth_query`, od razu uruchamia `authorize` i zwraca `{ redirect: true, url }`; klient Better Auth
  sam robi `window.location` (`better-auth/dist/client/fetch-plugins.mjs:7`).
- Dodatkowe kroki: `postLogin: { page, shouldRedirect, consentReferenceId }` — po zalogowaniu, przed zgodą;
  powrót przez `/oauth2/continue { postLogin: true }`.

## Tokeny

| Rzecz | Domyślnie (OAuthOptions 1.7.18) |
|---|---|
| access token | 3600 s (`accessTokenExpiresIn`); JWT (RFC 9068), gdy żądanie ma `resource` i jest `jwt()`, inaczej nieprzezroczysty |
| refresh token | 30 dni (`refreshTokenExpiresIn`), rotowany; zapisywany jako hash (`storeTokens: "hashed"`) |
| kod autoryzacji | 600 s |
| per-zasób | `resources: [{ identifier, accessTokenTtl, refreshTokenTtl, allowedScopes }]` |
| `grantTypes` | `authorization_code`, `client_credentials`, `refresh_token` — **ograniczyć do dwóch bez `client_credentials`** |

- Odwołanie: `/oauth2/revoke` (RFC 7009), introspekcja `/oauth2/introspect`, zgody: `/oauth2/get-consents`,
  `/oauth2/delete-consent` (do ekranu „podłączone agenty”, ticket 07).
- JWT access tokenu **nie da się odwołać przed `exp`** — weryfikacja jest lokalna (JWKS). Stąd kontrola
  użytkownika w bazie przy każdym `/mcp` (niżej) i krótki `accessTokenExpiresIn` (np. 300–900 s).

## Weryfikacja tokenu na `/mcp`

- `requireMcpAuth(auth, handler, { resource, requiredScopes })` z `@better-auth/mcp`: sprawdza podpis
  (JWKS), `iss`, `aud`, `exp`, wymaga `azp`, obsługuje DPoP (anti-replay w tabeli `verification`),
  zwraca 401 z `WWW-Authenticate` (RFC 9728) albo 403 `insufficient_scope`. Handler dostaje claims (`sub`).
- **Pułapka:** bez opcji `resource` domyślnym audience jest `baseURL` (`.../api/auth`), a token ma
  `aud` = `https://<host>/mcp` ⇒ każde żądanie 401. Trzeba podać ten sam `resource` co w `mcp()`.
- `jwksUrl` domyślnie `${baseURL}/jwks` — serwer pobiera własny publiczny URL (przez nginx/npmplus).
  **Nie sprawdzone** na jack; jeśli kontener nie widzi własnej domeny, użyć
  `createMcpProtectedRequestHandler` z `jwksUrl` na adres wewnętrzny albo `verifyJwsAccessToken`
  z `jwksFetch` jako funkcją (`@better-auth/core/oauth2`, `verify.d.mts`).
- Transport MCP (`@modelcontextprotocol/server` v2, `createMcpHandler({ legacy: "reject" })`, tylko POST)
  to ticket 03.

## Nowe tabele (Prisma)

`oauthClient`, `oauthResource`, `oauthClientResource`, `oauthRefreshToken`, `oauthAccessToken`,
`oauthConsent`, `oauthClientAssertion` (schemat w `authorize-*.mjs` paczki, `const schema`) + `jwks`
z wtyczki `jwt`. `oauthAccessToken`/`oauthRefreshToken` mają `sessionId → session` z
`onDelete: set null` i `userId → user`. Generowanie: `npx auth generate --output prisma/schema.prisma`,
potem `prisma migrate dev` (zgodność CLI z Prisma 7 i naszym `schema.prisma` — **do sprawdzenia**).
Wymóg: przy `secondaryStorage` trzeba `session.storeSessionInDatabase` (u nas brak secondaryStorage, OK).

## Jak to się składa z tym repo

### 2FA (ADR 0003) — główne ryzyko

Better Auth nie zna naszej bramki `sessionUser` (src/server/auth.server.ts:182-185). Wtyczka sprawdza
tylko „czy jest sesja” (`getSessionFromCtx`). Skutki:

- Prowadzący **z** TOTP: `/sign-in/email` nie ustawia ciasteczka sesji (tylko `twoFactorRedirect`), więc
  hook OAuth rusza dopiero po `verify-totp` — OK.
- Klucz dostępu: `/passkey/verify-authentication` ustawia sesję ⇒ hook rusza — OK (to pełne logowanie
  z ADR 0003).
- Prowadzący **bez** skonfigurowanego 2FA (nowe konto, po „Resetuj 2FA”): hasło daje pełną sesję
  (ADR 0003), więc `authorize` przejdzie do zgody i wyda token — **obejście bramki 2FA**.
  Naprawa w jednym miejscu: `postLogin.shouldRedirect` zwraca `true`, gdy konto nie ma TOTP ani klucza,
  z `postLogin.page: "/konfiguracja-2fa"`; po konfiguracji strona woła
  `authClient.oauth2.continue({ postLogin: true })` zamiast `navigate("/")`
  (src/routes/konfiguracja-2fa.tsx:26-29). Twarda kontrola i tak w `/mcp` (niżej).

### Rola `student` (ADR 0002)

Student ma zwykłą sesję Better Auth na tej samej domenie (magic link). Wtyczka nie patrzy na rolę, więc
student z sesją, który otworzy URL `authorize`, dostanie ekran zgody i token. Do tego domyślnie
**każdy zalogowany** (też student) może wołać `/oauth2/create-client` itp., bo `assertClientPrivileges`
bez `clientPrivileges` przepuszcza każdą sesję.

- `postLogin.shouldRedirect`: dla studenta rzucić `APIError` (autoryzacja przerwana przed zgodą).
- `clientPrivileges: () => false` (klientów tworzy tylko CIMD/DCR) albo wpisać ścieżki CRUD klientów
  do `disabledPaths` (wzorem src/server/auth.server.ts:100-111).
- Pas bezpieczeństwa przy wydaniu: `customAccessTokenClaims({ user })` dostaje użytkownika przy kodzie
  i przy odświeżeniu (tylko dla JWT, `resolveAccessTokenClaims`); rzucenie błędu blokuje wydanie.

### Blokada konta (admin `banUser`)

`banUser` kasuje sesje (`internalAdapter.deleteUserSessions`, z hookami). Hook wtyczki na usunięcie
sesji unieważnia tokeny tej sesji, **ale refresh tokenów z `offline_access` nie rusza**
(`prepareBackchannelLogoutPlan`: `!t.scopes?.includes("offline_access")`), a grant `refresh_token`
sprawdza tylko istnienie użytkownika (`handleRefreshTokenGrant`: `findUserById`, bez `banned`).
Do tego `resetTwoFactor` kasuje sesje Prismą bezpośrednio (src/server/auth.server.ts:194), więc hooki
w ogóle nie ruszą. Wniosek: zablokowany lub zresetowany prowadzący może dalej odświeżać tokeny.

### Jedna kontrola zamiast wielu

Najmniej kodu i pełne pokrycie: w handlerze `/mcp` po `requireMcpAuth` pobrać użytkownika po `sub` i
przepuścić tylko konto nie-studenta, niezablokowane, z TOTP albo kluczem — ta sama reguła co
`signedInTeacher` + `sessionUser` (src/server/auth.server.ts:166-185), wydzielona do funkcji po `userId`.
Działa natychmiast dla bana, resetu 2FA i studenta, niezależnie od żywotności tokenu. Dodatkowo przy
banie/resecie usuwać wiersze `oauthRefreshToken`/`oauthAccessToken` użytkownika (porządek, nie warunek).

### Trasy `/login` i `/konfiguracja-2fa`

Da się je podpiąć (`loginPage: "/login"`, `postLogin.page: "/konfiguracja-2fa"`), z poprawkami:

- `teacherAuthClient` (src/lib/teacher-auth-client.ts:6) potrzebuje `oauthProviderClient()`; bez tego
  logowanie nie wraca do `authorize`.
- `/login` `beforeLoad` przekierowuje zalogowanego na `/` (src/routes/login.tsx:21-23) — psuje
  `prompt=login`; przy obecnym `sig` w URL trzeba to pominąć.
- `enter()` w `/login` (src/routes/login.tsx:36-40) robi `navigate(target ?? "/")`, co ściga się
  z przekierowaniem `{ redirect, url }` z serwera; w przepływie OAuth nie nawigować samemu.
- `/konfiguracja-2fa` `beforeLoad` odsyła na `/` konto z gotowym 2FA (linia 15) — przy `sig` w URL
  powinno wołać `oauth2.continue`.
- Ekran zgody to nowa trasa (np. `/zgoda`): nazwa klienta (`/oauth2/public-client`), zakresy,
  przyciski akceptuj/odrzuć. Istniejących ekranów nie wystarczy.
- `loginSearchSchema` (src/schemas/auth.ts:16-23) obetnie nieznane parametry z `search` w routerze, ale
  `oauthProviderClient` czyta `window.location.search`, więc podpisane zapytanie przeżyje —
  **do sprawdzenia w prototypie**.

## Niepotwierdzone (do prototypu)

1. Czy `postLogin.shouldRedirect` rzucający `APIError` daje sensowny błąd klientowi (a nie 500).
2. Czy hook `after` przy `verify-totp` / `passkey/verify-authentication` faktycznie dostaje `oauth_query`
   z ciała (wtyczka klienta dokleja je do każdego POST-a, więc powinien).
3. Czy POST-y na `/konfiguracja-2fa` (np. włączenie TOTP, które odnawia sesję) nie odpalą `authorize`
   za wcześnie — dokleja się do nich `oauth_query`.
4. Czy `deleteManyWithHooks` w `deleteUserSessions` woła hook `session.delete` dla każdego wiersza.
5. Czy Claude.ai/Claude Code wysyła `offline_access` i czy używa CIMD (ticket 01).
6. `npx auth generate` z Prisma 7 i ręcznie utrzymywanym `schema.prisma`.
7. Pobieranie własnego `/api/auth/jwks` z kontenera na jack.
