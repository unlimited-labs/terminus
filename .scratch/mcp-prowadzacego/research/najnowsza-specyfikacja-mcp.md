# Najnowsza specyfikacja MCP dla zdalnego serwera (stan na 2026-11-24)

Źródła: tylko pierwotne (spec + changelog + schema na modelcontextprotocol.io / repo
`modelcontextprotocol/modelcontextprotocol`, dokumentacja Anthropic na claude.com i code.claude.com,
dokumentacja dostawców pozostałych klientów). Cytowane gałęzie i strony czytane 2026-11-24.

## 1. Wersje

| Wersja | Status | Data wydania (GitHub release) |
| --- | --- | --- |
| **2026-07-28** | **Current** | 2026-07-28 (RC 2026-05-29) |
| 2025-11-25 | Final | 2025-11-25 |
| 2025-06-18, 2025-03-26, 2024-11-05 | Final | — |
| draft | Draft | po 2026-07-28; na razie jedna zmiana istotna dla nas: CIMD wg `draft-ietf-oauth-client-id-metadata-document-03` zamiast `-00` |

- „The current protocol version is 2026-07-28” — https://modelcontextprotocol.io/specification/versioning
- Changelog: https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Rejestr deprecjacji: https://modelcontextprotocol.io/specification/2026-07-28/deprecated
- Draft changelog: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/changelog.mdx

**2026-07-28 to przełom: MCP jest bezstanowy.** Zniknął handshake `initialize`/`notifications/initialized`,
zniknęły sesje (`Mcp-Session-Id`), GET-stream, wznawianie SSE (`Last-Event-ID`), `ping`, `logging/setLevel`.
Każde żądanie niesie w `_meta` wersję protokołu (`io.modelcontextprotocol/protocolVersion`) i capabilities
klienta (`io.modelcontextprotocol/clientCapabilities`). Nowe: obowiązkowe RPC `server/discover`,
`subscriptions/listen`, wzorzec Multi Round-Trip Requests (MRTR) zamiast żądań serwer→klient, wymagane
pole `resultType` w każdym wyniku. Klienci z ery 2025-xx nadal istnieją (patrz pkt 6), więc serwer
musi obsłużyć obie ery.

## 2. Transport Streamable HTTP (2026-07-28)

Źródło: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

- Jeden endpoint (u nas `/mcp`), **tylko POST**. Body = jedno żądanie albo powiadomienie JSON-RPC (bez batchy).
  Powiadomienie → `202 Accepted` bez body. Żądanie → `application/json` **albo** `text/event-stream`;
  klient MUST obsłużyć oba.
- SSE tylko jako strumień odpowiedzi na dane żądanie: wolno wysłać przed odpowiedzią powiadomienia
  dotyczące tego żądania (np. `notifications/progress`), **nie wolno wysyłać żądań** serwer→klient.
  Strumień nie jest wznawialny; zerwany = klient ponawia z nowym `id`.
  Zamknięcie strumienia przez klienta = anulowanie.
- **Sesji brak.** Stan między wywołaniami tylko przez jawne „uchwyty” zwracane z narzędzi i
  podawane jako argumenty (sekcja „Stateful Tools” w spec narzędzi); serwer sprawdza uprawnienia
  do uchwytu przy każdym wywołaniu.
- Nagłówki wymagane na każdym POST:
  - `MCP-Protocol-Version: 2026-07-28` — MUST być równy wersji w `_meta`, inaczej `400` + `HeaderMismatchError` (`-32020`).
    Nieobsługiwana wersja → `400` + `UnsupportedProtocolVersionError` (`-32022`) z listą `supported`.
  - `Mcp-Method` (zawsze) i `Mcp-Name` (dla `tools/call`, `resources/read`, `prompts/get`);
    serwer MUST sprawdzić zgodność z body (po dekodowaniu ewentualnego `=?base64?...?=`).
  - `Accept: application/json, text/event-stream`.
  - Opcjonalnie `x-mcp-header` w `inputSchema` → klient lustrzanie wysyła `Mcp-Param-{Name}`; nam niepotrzebne.
- Bezpieczeństwo: serwer MUST walidować `Origin` (zły → `403`); SHOULD mieć uwierzytelnianie.
- `tools/list` MUST NOT zależeć od połączenia, SHOULD mieć deterministyczną kolejność; wyniki list
  muszą nieść `ttlMs` i `cacheScope` (`"public"`/`"private"`; czy pośrednicy mogą cache'ować).
- Zgodność wstecz (ta sama strona, sekcja Backward Compatibility, oraz
  https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning):
  serwer **MAY** obsługiwać obie ery. Serwer tylko-nowy na ruch starego klienta: GET/DELETE → `405`,
  `Mcp-Session-Id` i `Last-Event-ID` ignorować, a na `initialize` SHOULD zwrócić błąd z listą
  obsługiwanych wersji. Klient nowej ery próbuje nowego żądania i przy `400` z nieznanym body spada do `initialize`.

**Era 2025-11-25 (wciąż potrzebna dla klientów hostowanych, pkt 6):** handshake `initialize`,
sesja opcjonalna (serwer **MAY** nadać `Mcp-Session-Id`), GET-stream opcjonalny (wolno `405`),
`MCP-Protocol-Version` na kolejnych żądaniach (brak → zakładać `2025-03-26`). Tryb „bezstanowy”
w tej erze = brak `Mcp-Session-Id`, odpowiedzi JSON lub SSE per żądanie.
https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

## 3. Autoryzacja (2026-07-28)

Źródła: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization ,
`.../authorization/client-registration`, `.../authorization/authorization-server-discovery`,
`.../authorization/security-considerations`

Serwer MCP (resource server):
- MUST: **Protected Resource Metadata (RFC 9728)** — przez `WWW-Authenticate: Bearer resource_metadata="..."`
  w odpowiedzi `401` albo pod well-known (`/.well-known/oauth-protected-resource/mcp`, potem
  `/.well-known/oauth-protected-resource`). Dokument MUST zawierać `authorization_servers`.
- SHOULD: `scope="..."` w `WWW-Authenticate`; przy braku uprawnień runtime `403` +
  `error="insufficient_scope"` + `scope` + `resource_metadata` (step-up).
- MUST: walidować token, w tym **audience = ten serwer (RFC 8707)**; zły/wygasły → `401`; nie
  przyjmować ani nie przekazywać dalej innych tokenów. Token tylko w nagłówku `Authorization`, nigdy w query.
- SHOULD NOT dawać `offline_access` w `scopes_supported` PRM ani w `WWW-Authenticate`.

Serwer autoryzacji (u nas aplikacja):
- MUST OAuth 2.1 (publiczni i poufni klienci); MUST udostępnić RFC 8414 **albo** OIDC Discovery.
- PKCE: klient MUST użyć `S256` i MUST odmówić, gdy w metadanych AS brak `code_challenge_methods_supported`.
- Wszystkie endpointy HTTPS; redirect URI tylko `localhost` albo HTTPS. Dla publicznych klientów
  MUST rotować refresh tokeny.
- SHOULD zwracać `iss` w odpowiedzi autoryzacyjnej (RFC 9207) i wtedy MUST ogłosić
  `authorization_response_iss_parameter_supported: true` (zapowiedź: w przyszłości MUST).
- Rejestracja klienta — kolejność po stronie klienta: pre-registracja → **CIMD** (gdy AS ma
  `client_id_metadata_document_supported: true`) → **DCR (RFC 7591)** (gdy jest `registration_endpoint`) → ręcznie.
  - **CIMD: SHOULD** (AS i klient). `client_id` = URL HTTPS z dokumentem JSON (`client_id`, `client_name`,
    `redirect_uris`); AS MUST pobrać dokument, sprawdzić że `client_id` = URL, walidować redirect URI.
    Draft spec już wskazuje wersję `-03` draftu IETF.
  - **DCR: MAY, od 2026-07-28 Deprecated** (najwcześniejsze usunięcie: pierwsza wersja ≥ 2027-07-28).
    Klient MUST podać `application_type` (`native` dla loopback, `web` dla hostowanych).
  - Dane klienta są związane z issuerem (klient MUST kluczować je po issuerze).
- Klient MUST wysyłać `resource` (RFC 8707) w żądaniu autoryzacji i tokenu, z kanonicznym URI serwera MCP
  (bez końcowego `/`, np. `https://host/mcp`).

## 4. Narzędzia (2026-07-28)

Źródła: https://modelcontextprotocol.io/specification/2026-07-28/server/tools ,
schema `ToolAnnotations`: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts

- `inputSchema` MUST być obiektem JSON Schema (domyślnie 2020-12). `outputSchema` opcjonalny; jeśli
  jest, serwer **MUST** zwracać `structuredContent` z nim zgodny, klient SHOULD walidować.
- 2026-07-28 poluzował: dowolne słowa kluczowe 2020-12, `structuredContent` = dowolna wartość JSON
  (w 2025-11-25: `outputSchema` z `type: "object"`, `structuredContent` = obiekt — **trzymać się obiektów,
  żeby działało w obu erach**).
- SHOULD: dla zgodności wstecz dołączać serializowany JSON także jako blok `text` w `content`.
- Adnotacje (wszystkie to **podpowiedzi**, klient MUST traktować je jako niezaufane od niezaufanych serwerów):
  `title`; `readOnlyHint` (domyślnie false); `destructiveHint` (domyślnie **true**, ma sens gdy readOnly=false);
  `idempotentHint` (domyślnie false); `openWorldHint` (domyślnie true — u nas ustawiać `false`).
- Błędy: protokołowe (nieznane narzędzie, zły request) → błąd JSON-RPC (`-32602` itd.);
  **błędy wykonania (walidacja, logika biznesowa) → wynik z `isError: true`** i treścią, z której model
  może się poprawić. Klient SHOULD przekazać je modelowi.
- `tools/call` może zwrócić `InputRequiredResult` (MRTR) — patrz elicitation.
- Nazwy: 1–128 znaków `[A-Za-z0-9_.-]`; katalog Claude wymaga ≤ 64.
- Serwer MUST: walidować wejście, kontrolować dostęp, limitować częstotliwość, sanityzować wyjście.

## 5. Elicitation

Źródła: https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation ,
https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr

- Dwa tryby: `form` (płaski obiekt, typy prymitywne/enum; dane widzi klient) i `url` (interakcja poza
  klientem, np. strona w naszej aplikacji). Danych wrażliwych (hasła, sekrety) MUST NOT zbierać formularzem.
- Serwer MUST NOT prosić o tryb, którego klient nie zadeklarował (`elicitation: {}` = tylko `form`).
- **2026-07-28 (MRTR):** serwer zwraca na `tools/call` wynik `resultType: "input_required"` z
  `inputRequests` (+ opcjonalny `requestState`); klient ponawia całe żądanie (nowe `id`) z
  `inputResponses` i tym samym `requestState`. Bezstanowe. `requestState` = dane od atakującego →
  MUST chronić integralność (HMAC/AEAD), SHOULD wiązać z użytkownikiem i czasem (anty-replay).
  Serwer MUST NOT zakładać, że klient odpowie. Usunięto `notifications/elicitation/complete` i `elicitationId`.
- **2025-11-25:** `elicitation/create` to żądanie serwer→klient wysyłane w strumieniu SSE odpowiedzi;
  odpowiedź klienta przychodzi osobnym POST-em — w praktyce wymaga pamięci serwera między żądaniami
  (sesja/afinitet), czyli kłóci się z trybem bezstanowym.

## 6. Co faktycznie obsługują klienci (dokumentacja dostawców, 2026-11)

### Claude.ai, Claude Desktop, mobile, Cowork („hostowane”) i Claude Code — wspólna infrastruktura OAuth

Źródła: https://claude.com/docs/connectors/building/index.md ,
https://claude.com/docs/connectors/building/authentication.md ,
https://claude.com/docs/connectors/building/review-criteria.md , https://claude.com/docs/connectors/building/mcp.md

- Transport: Streamable HTTP (zalecany) + legacy HTTP+SSE.
- **Wersja auth wg dokumentacji: 2025-03-26, 2025-06-18, 2025-11-25** — o 2026-07-28 dla
  powierzchni hostowanych dokumentacja milczy (**niepotwierdzone**, zakładać erę 2025-11-25).
- Rejestracja: `oauth_dcr` i `oauth_cimd` „supported by default”. **Claude wybiera CIMD tylko gdy metadane
  AS mają `"client_id_metadata_document_supported": true` ORAZ `"none"` w
  `token_endpoint_auth_methods_supported`; inaczej DCR** (wymaga `registration_endpoint`). DCR rejestruje
  nowego klienta przy każdym świeżym połączeniu. Alternatywnie client ID/secret wpisane przy dodawaniu
  custom connectora.
- Redirect hostowany: `https://claude.ai/api/mcp/auth_callback`. Claude Code: własny CIMD
  `https://claude.ai/oauth/claude-code-client-metadata`, loopback `http://localhost:<port>/callback` i
  `http://127.0.0.1:<port>/callback` — AS musi dopasować **bez portu** dla obu.
- Ostrzejsze niż spec: wymagany `401` (nagłówek na `200` ignorowany); `resource` w PRM musi
  **dokładnie** równać się URL wpisanemu przez użytkownika (z path); brany tylko **pierwszy**
  `authorization_servers`; timeouty: discovery/rejestracja/token 10 s, refresh 30 s; `/token` musi
  przyjmować `application/x-www-form-urlencoded`; przy złym refresh tokenie `invalid_grant`; PKCE S256
  zawsze; Claude dopisuje `offline_access`, jeśli jest w `scopes_supported` AS; ruch z `160.79.104.0/21`.
- Funkcje: tools, prompts, resources, wyniki tekstowe i obrazkowe. **Nieobsługiwane: subskrypcje
  zasobów, sampling, „advanced or draft capabilities”.** **Elicitation na claude.ai/Desktop nie jest
  nigdzie udokumentowany** (0 wzmianek w pełnym `llms-full.txt` claude.com) — **nie można na nim polegać**.
- Adnotacje: katalog wymaga `title` i `readOnlyHint`/`destructiveHint` na każdym narzędziu; „Read-only
  tools can run without per-call confirmation, and destructive tools always prompt”.
- Limity: wynik ~150 000 znaków, timeout wywołania 240 s (hostowane).

### Claude Code

Źródło: https://code.claude.com/docs/en/mcp

- Dwa runtime'y: v1 (TS SDK 1.x) i **v2 (TS SDK 2.0, dodaje 2026-07-28)**; v2 domyślnie od v2.1.232
  (z feature flagami) / v2.1.274. Na v2 Claude Code pyta serwery HTTP (i konektory claude.ai) o
  2026-07-28 i używa jej, jeśli ją wspierają; inaczej stara era. Na v2 odrzuca logowanie z
  niezgodnym `iss` i wysyła dane tylko do token endpointu HTTPS/localhost.
- OAuth: discovery RFC 9728 → fallback RFC 8414; DCR, CIMD (auto), albo `--client-id/--client-secret`
  + `--callback-port`.
- **Elicitation: form + URL** (`{form:{}, url:{}}`) na 2026-07-28 i na starszych dla serwerów z
  konfiguracji (od v2.1.287); dla konektorów claude.ai na starej erze tylko `{}` = form. Tylko w sesji
  interaktywnej; w `-p` żądanie jest anulowane.
- Adnotacje: `readOnlyHint` → równoległe wywołania; `idempotentHint`/`readOnlyHint` → ponowienie po
  zerwanym połączeniu; `_meta["anthropic/requiresUserInteraction"]: true` → pytanie o zgodę przy
  każdym wywołaniu, nawet w trybach auto/bypass.
- Gdy narzędzie zwraca `structuredContent`, model dostaje ten JSON zamiast tekstu z `content`
  (quickstart MCP Apps na claude.com, `llms-full.txt`).
- Limit wyniku domyślnie 25 000 tokenów (`MAX_MCP_OUTPUT_TOKENS`).

### Inni klienci

| Klient | Rejestracja OAuth | Elicitation | Źródło |
| --- | --- | --- | --- |
| ChatGPT | **CIMD zalecany** (`none` lub `private_key_jwt`), DCR nadal wspierany | nie wspomniane | https://developers.openai.com/api/docs/mcp/ |
| Cursor | DCR (klient publiczny) lub statyczny `CLIENT_ID`; PKCE; CIMD nie wspomniany | „Supported” | https://cursor.com/docs/context/mcp |
| VS Code (Copilot) | DCR lub pre-rejestrowany client ID; CIMD nie wspomniany | form + URL podczas aktywnej tury | https://code.visualstudio.com/api/extension-guides/ai/mcp |

Matryca rozszerzeń (MCP Apps, Tasks itd.) — społecznościowa:
https://modelcontextprotocol.io/extensions/client-matrix . Dawnej matrycy funkcji klientów
(`/clients`) już nie ma na modelcontextprotocol.io.

## 7. Wnioski dla serwera prowadzącego

1. Serwer musi mówić **obiema erami**: 2025-11-25 (`initialize`, bez `Mcp-Session-Id`, odpowiedzi
   JSON) dla claude.ai/Desktop/ChatGPT/Cursor i 2026-07-28 (bezstanowy, `server/discover`,
   nagłówki `Mcp-Method`/`Mcp-Name`) dla Claude Code v2. Czy TS SDK 2.0 robi to za nas — ticket 03.
2. Serwer autoryzacji: PRM + RFC 8414, PKCE S256 z `code_challenge_methods_supported`,
   RFC 8707 (audience), rotacja refresh tokenów, `iss` (RFC 9207). **Rejestracja: CIMD
   (z `"none"` w `token_endpoint_auth_methods_supported`) ORAZ DCR** — DCR jest w spec deprecated, ale
   Cursor i VS Code nie dokumentują CIMD. Czy Better Auth to umie — ticket 02.
3. Narzędzia: `structuredContent` jako obiekt + kopia JSON w bloku `text`; `outputSchema` z
   `type: "object"`; komplet adnotacji (`title`, `readOnlyHint`, `destructiveHint`,
   `idempotentHint`, `openWorldHint: false`); błędy biznesowe przez `isError: true`.
4. **Potwierdzenie operacji nieodwracalnych nie może opierać się na elicitation** (brak na
   claude.ai/Desktop, brak w dokumentacji ChatGPT). Bazą jest `destructiveHint: true` (Claude zawsze
   pyta) + ewentualny wzorzec w samych narzędziach; elicitation tylko jako ulepszenie, gdy klient
   je zadeklaruje. Ticket 06.

## Niepotwierdzone / luki

- Czy claude.ai/Desktop/mobile negocjują 2026-07-28 — dokumentacja wymienia tylko wersje auth 2025-xx.
- Elicitation na claude.ai/Desktop — brak jakiejkolwiek wzmianki; artykuł help center
  `support.claude.com/.../11503834` zwraca dziś 404.
- Jak hostowany Claude podaje modelowi `structuredContent` dla zwykłych narzędzi serwera (udokumentowane
  tylko dla narzędzi widoku MCP Apps: czyta `structuredContent` tylko przy braku tekstu).
- CIMD w Cursor i VS Code — strony nie wspominają, więc nie zakładać.
- Wersje klientów ChatGPT/Cursor/VS Code dot. protokołu 2026-07-28 — nie podane.
