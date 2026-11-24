/** Host z `client_id` agenta AI. Przy CIMD `client_id` to adres dokumentu klienta; inny identyfikator = `null`. */
export const agentHost = (clientId: string) =>
  (URL.canParse(clientId) && new URL(clientId).host) || null

/** Czy trasa jest częścią podłączania agenta: serwer autoryzacji odsyła tu z podpisanym zapytaniem `authorize` (parametr `sig`). */
export const isAgentConnectFlow = (search: object) => "sig" in search
