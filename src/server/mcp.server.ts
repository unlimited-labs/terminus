import { requireMcpAuth } from "@better-auth/mcp"
import { createResourceServerChallenge } from "@better-auth/oauth-provider"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { APIError } from "better-auth/api"
import { z } from "zod"

import { boardInputSchema } from "../schemas/board.ts"
import {
  addTeacherSchema,
  deleteExamSchema,
  duplicateExamSchema,
  examFormSchema,
  examIdSchema,
  removeTeacherSchema,
} from "../schemas/exam.ts"
import {
  boardCommandOutput,
  createExamOutput,
  emptyOutput,
  entryEmailsOutput,
  examCsvOutput,
  examDetailOutput,
  freeSlotsDeletedOutput,
  listExamsOutput,
  rosterImportPreviewOutput,
  slotWindowOutput,
} from "../schemas/mcp-output.ts"
import {
  addEntrySchema,
  entryEmailSchema,
  entryRefSchema,
  rosterApplySchema,
  rosterImportSchema,
  rosterRefSchema,
} from "../schemas/roster.ts"
import { dayRefSchema, slotRefSchema, updateSlotSchema, windowSchema } from "../schemas/slot.ts"

import { auth, MCP_RESOURCE, teacherById } from "./auth.server.ts"
import { runBoardCommand } from "./board-ops.server.ts"
import { db } from "./db.server.ts"
import { env } from "./env.server.ts"
import {
  addTeacher,
  copyExam,
  examCsv,
  examsOf,
  insertExam,
  readExam,
  removeExam,
  removeTeacher,
  updateExamSettings,
} from "./exam-ops.server.ts"
import { mcpCaller, toolRegistrar, type McpCaller } from "./mcp-tools.server.ts"
import {
  addEntry,
  applyImport,
  deleteEntry,
  entryEmails,
  previewImport,
  removeRoster,
  setEntryEmail,
} from "./roster-ops.server.ts"
import { addWindow, editSlot, removeFreeSlotsOfDay, removeSlot } from "./slot-ops.server.ts"

const INSTRUCTIONS = [
  "Terminus: zapisy studentów na zaliczenia.",
  "Identyfikator zaliczenia (`examId`) weź z `list_exams`.",
  "Zanim cokolwiek zmienisz, przeczytaj `get_exam` — tam są identyfikatory slotów, list i numery indeksów.",
  "Wszystkie godziny są w czasie polskim.",
  "Zmianę na tablicy cofniesz, podając zwrócone `inverse` do `board_command`.",
  "Import listy to dwa kroki: `preview_roster_import`, pokaż podgląd prowadzącemu, potem `apply_roster_import`.",
].join(" ")

const READ = { readOnlyHint: true, idempotentHint: true }

/** Serwer MCP na jedno żądanie; prowadzącego i host klienta podaje trasa `/mcp` w `authInfo.extra`. */
export const mcpHandler = createMcpHandler(
  ({ authInfo }) => {
    const server = new McpServer(
      { name: "terminus", version: "1.0.0" },
      { instructions: INSTRUCTIONS },
    )
    const caller = mcpCaller.parse(authInfo?.extra)
    const { user } = caller
    const tool = toolRegistrar(server, caller)

    tool(
      "list_exams",
      {
        title: "Lista zaliczeń",
        description:
          "Zaliczenia, które prowadzę, od najnowszych: etap, liczba osób na listach i zapisanych, terminy slotów.",
        inputSchema: z.object({}),
        outputSchema: listExamsOutput,
        annotations: READ,
      },
      async () => ({ ok: true, exams: await examsOf(user.id) }),
    )

    tool(
      "get_exam",
      {
        title: "Zaliczenie",
        description:
          "Pełny stan zaliczenia: ustawienia, prowadzący, listy indeksów, sloty, osoby z zapisem i oceną, link do strony zapisów.",
        inputSchema: examIdSchema,
        outputSchema: examDetailOutput,
        annotations: READ,
      },
      async ({ examId }) => {
        const exam = await readExam(examId, user.id)
        return exam && { ok: true, ...exam, link: new URL(`/z/${examId}`, env.APP_PUBLIC_URL).href }
      },
    )

    tool(
      "create_exam",
      {
        title: "Nowe zaliczenie",
        description:
          "Tworzy zaliczenie z ustawieniami jak w formularzu; jestem jego prowadzącym. Start zapisów: data i godzina po polsku albo oba pola puste.",
        inputSchema: examFormSchema,
        outputSchema: createExamOutput,
        annotations: {},
      },
      (data) => insertExam(user.id, data),
    )

    tool(
      "update_exam",
      {
        title: "Ustawienia zaliczenia",
        description:
          "Zmienia wszystkie ustawienia zaliczenia naraz (podaj pełny formularz, bieżące wartości weź z `get_exam`).",
        inputSchema: examFormSchema.and(examIdSchema),
        outputSchema: emptyOutput,
        annotations: { idempotentHint: true },
      },
      ({ examId, ...data }) => updateExamSettings(examId, user.id, data),
    )

    tool(
      "delete_exam",
      {
        title: "Usunięcie zaliczenia",
        description:
          "Usuwa zaliczenie. Znikną listy indeksów, sloty i wszystkie zapisy. Powiedz to prowadzącemu przed wywołaniem. `confirmName` = dokładna nazwa zaliczenia.",
        inputSchema: deleteExamSchema,
        outputSchema: emptyOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, confirmName }) => removeExam(examId, { teacher: user.id }, confirmName),
    )

    tool(
      "copy_exam",
      {
        title: "Kopia zaliczenia",
        description:
          "Nowe zaliczenie z ustawieniami tego (np. poprawka), opcjonalnie z listami indeksów; bez slotów i zapisów.",
        inputSchema: duplicateExamSchema,
        outputSchema: createExamOutput,
        annotations: {},
      },
      ({ examId, copyRosters }) => copyExam(examId, user.id, copyRosters),
    )

    tool(
      "add_exam_teacher",
      {
        title: "Dodanie prowadzącego",
        description: "Dodaje prowadzącego do zaliczenia po adresie e-mail jego konta.",
        inputSchema: addTeacherSchema,
        outputSchema: emptyOutput,
        annotations: {},
      },
      ({ examId, email }) => addTeacher(examId, user.id, email),
    )

    tool(
      "remove_exam_teacher",
      {
        title: "Usunięcie prowadzącego",
        description:
          "Usuwa prowadzącego z zaliczenia (identyfikator z `get_exam`). Usunięcie siebie: stracisz do niego dostęp, przywrócić może cię inny prowadzący. Powiedz to prowadzącemu przed wywołaniem.",
        inputSchema: removeTeacherSchema,
        outputSchema: emptyOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, teacherId }) => removeTeacher(examId, user.id, teacherId),
    )

    tool(
      "export_exam_csv",
      {
        title: "Eksport CSV",
        description: "Lista osób z zapisami i ocenami jako plik CSV (nazwa pliku i treść).",
        inputSchema: examIdSchema,
        outputSchema: examCsvOutput,
        annotations: READ,
      },
      ({ examId }) => examCsv(examId, user.id),
    )

    tool(
      "list_entry_emails",
      {
        title: "Adresy e-mail z list",
        description: "Adresy e-mail osób z list indeksów zaliczenia, po numerze indeksu.",
        inputSchema: examIdSchema,
        outputSchema: entryEmailsOutput,
        annotations: READ,
      },
      async ({ examId }) => {
        const emails = await entryEmails(examId, user.id)
        return emails && { ok: true, emails }
      },
    )

    tool(
      "board_command",
      {
        title: "Zmiana na tablicy",
        description:
          "Jedno polecenie tablicy zapisów: przeniesienie, zamiana osób lub slotów, zmiana nazwiska, wypisanie lub zapisanie zespołu, odpowiedzi, oceny. Zwraca `inverse` — podane z powrotem do `board_command` cofa tę zmianę.",
        inputSchema: boardInputSchema,
        outputSchema: boardCommandOutput,
        annotations: {},
      },
      ({ examId, command }) => runBoardCommand(examId, user.id, command),
    )

    tool(
      "add_slot_window",
      {
        title: "Dodanie slotów",
        description:
          "Tnie okno `from`–`to` dnia `date` (czas polski) na sloty po `minutes` minut dla listy `rosterId`. Odmawia, gdy okno nachodzi na istniejący slot.",
        inputSchema: windowSchema,
        outputSchema: slotWindowOutput,
        annotations: {},
      },
      (data) => addWindow(data.examId, user.id, data),
    )

    tool(
      "update_slot",
      {
        title: "Zmiana slotu",
        description:
          "Ustawia dzień, godziny (czas polski) i listę slotu. Zapisy w slocie zostają. Odmawia, gdy slot nachodzi na inny.",
        inputSchema: updateSlotSchema,
        outputSchema: emptyOutput,
        annotations: { idempotentHint: true },
      },
      (data) => editSlot(data.examId, user.id, data),
    )

    tool(
      "delete_slot",
      {
        title: "Usunięcie slotu",
        description:
          "Usuwa slot. Slotu z zapisami nie usunie (`SLOT_HAS_ENROLLMENTS`): najpierw przenieś albo wypisz zespół. Zanim wywołasz, powiedz prowadzącemu, który slot zniknie (dzień i godziny).",
        inputSchema: slotRefSchema,
        outputSchema: emptyOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, slotId }) => removeSlot(examId, user.id, slotId),
    )

    tool(
      "delete_free_slots_of_day",
      {
        title: "Usunięcie wolnych slotów dnia",
        description:
          "Dzień `day` (czas polski): znikną wszystkie sloty bez zapisów. Sloty z zapisami zostaną. Zanim wywołasz, powiedz to prowadzącemu.",
        inputSchema: dayRefSchema,
        outputSchema: freeSlotsDeletedOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, day }) => removeFreeSlotsOfDay(examId, user.id, day),
    )

    tool(
      "preview_roster_import",
      {
        title: "Podgląd importu listy",
        description:
          "Co zrobi import pliku CSV (kolumny `indeks;imie;nazwisko`, opcjonalnie `email`, `skreslony`, `rezygnacja`) do listy o tej nazwie: kto dojdzie, komu zmieni się nazwisko, kto zniknie. Nic nie zapisuje. Pokaż podgląd prowadzącemu, a po jego zgodzie wywołaj `apply_roster_import` z tymi samymi danymi i z numerami indeksów z `withdrawnEnrolled`.",
        inputSchema: rosterImportSchema,
        outputSchema: rosterImportPreviewOutput,
        annotations: READ,
      },
      ({ examId, rosterName, csv }) => previewImport(examId, user.id, rosterName, csv),
    )

    tool(
      "apply_roster_import",
      {
        title: "Import listy",
        description:
          "Zapisuje import pliku CSV do listy, zatwierdzony w `preview_roster_import`. `withdrawnEnrolled` = numery indeksów z `withdrawnEnrolled` podglądu; gdy zapisy zmieniły się od podglądu, odmawia (`IMPORT_PREVIEW_STALE`) — zrób podgląd jeszcze raz. Skreśleni znikną z listy; skreśleni z zapisem znikną z listy, a ich zapis zostanie usunięty. Zanim wywołasz, powiedz to prowadzącemu.",
        inputSchema: rosterApplySchema,
        outputSchema: emptyOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, rosterName, csv, withdrawnEnrolled }) =>
        applyImport(examId, user.id, rosterName, csv, withdrawnEnrolled),
    )

    tool(
      "add_roster_entry",
      {
        title: "Dodanie osoby do listy",
        description:
          "Dopisuje osobę do listy `rosterId`. Pusty `rosterId` tylko, gdy zaliczenie nie ma jeszcze list — powstanie lista „lista”. Pusty `email` = adres domyślny z numeru indeksu.",
        inputSchema: addEntrySchema,
        outputSchema: emptyOutput,
        annotations: {},
      },
      (data) => addEntry(data.examId, user.id, data),
    )

    tool(
      "delete_roster_entry",
      {
        title: "Usunięcie osoby z listy",
        description:
          "Usuwa osobę z listy indeksów. Osoby z zapisem nie usunie (`ENTRY_HAS_ENROLLMENT`): najpierw przenieś albo usuń zapis.",
        inputSchema: entryRefSchema,
        outputSchema: emptyOutput,
        annotations: {},
      },
      ({ examId, studentNumber }) => deleteEntry(examId, user.id, studentNumber),
    )

    tool(
      "delete_roster",
      {
        title: "Usunięcie listy",
        description:
          "Usuwa listę indeksów. Znikną jej osoby i sloty. Jeśli ktoś z tej listy ma zapis, lista zostanie — najpierw przenieś albo usuń zapisy. Zanim wywołasz, powiedz prowadzącemu, co zniknie.",
        inputSchema: rosterRefSchema,
        outputSchema: emptyOutput,
        annotations: { destructiveHint: true },
      },
      ({ examId, rosterId }) => removeRoster(examId, user.id, rosterId),
    )

    tool(
      "set_entry_email",
      {
        title: "Adres e-mail osoby",
        description: "Ustawia adres e-mail osoby z listy. Pusty = adres domyślny z numeru indeksu.",
        inputSchema: entryEmailSchema,
        outputSchema: emptyOutput,
        annotations: { idempotentHint: true },
      },
      ({ examId, studentNumber, email }) => setEntryEmail(examId, user.id, studentNumber, email),
    )

    return server
  },
  { legacy: "stateless", responseMode: "json" },
)

/** 401 jak przy złym tokenie: klient z `WWW-Authenticate` wraca do logowania i zgody. */
function unauthorized() {
  const challenge = createResourceServerChallenge(
    new APIError("UNAUTHORIZED", { message: "invalid_token" }),
    MCP_RESOURCE,
  )
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "invalid_token" }, id: null },
    { status: 401, headers: challenge?.headers },
  )
}

const hostOf = (clientId: string) => (URL.canParse(clientId) ? new URL(clientId).host : clientId)

/**
 * `POST /mcp`: podpis i `aud` tokenu, potem przy każdym żądaniu konto (`teacherById`) i zgoda na
 * klienta — zablokowanie, utrata 2FA i odłączenie agenta działają od razu, nie po wygaśnięciu tokenu.
 */
export const serveMcp = requireMcpAuth(
  auth,
  async (request, claims) => {
    const clientId = String(claims.azp)
    const user = claims.sub ? await teacherById(claims.sub) : null
    const consent =
      user &&
      (await db.oauthConsent.findFirst({
        where: { userId: user.id, clientId },
        select: { id: true },
      }))
    if (!user || !consent) return unauthorized()
    return mcpHandler.fetch(request, {
      authInfo: {
        token: "",
        clientId,
        scopes: [],
        expiresAt: claims.exp,
        extra: { user, clientHost: hostOf(clientId) } satisfies McpCaller,
      },
    })
  },
  // Token ma `iss` = domena (`jwt.issuer`); domyślny issuer tutaj to `…/api/auth`.
  { resource: MCP_RESOURCE, issuer: new URL(env.APP_PUBLIC_URL).origin },
)
