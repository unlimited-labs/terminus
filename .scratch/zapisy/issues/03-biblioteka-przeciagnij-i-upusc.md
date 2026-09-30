# Biblioteka przeciągnij-i-upuść

Type: research
Status: resolved

## Question

Która biblioteka drag-and-drop dla Reacta najlepiej pasuje do tablicy:
kolumny-sloty z kafelkami-indeksami, przenoszenie między slotami, zamiana
dwóch kafelków miejscami przez upuszczenie jednego na drugi, odrzucenie
upuszczenia na pełny slot, obsługa klawiatury i dotyku? Porównać aktualny stan
dnd-kit (w tym nowe `@dnd-kit/react`), Pragmatic drag and drop i ewentualne
inne żywe opcje: utrzymanie, zgodność z React 19, dostępność, gotowe wzorce
dla zamiany (swap). Sprawdzić też, czy shadcn/ui działa bez przeszkód
z TanStack Start.

## Answer

Pełne wyniki ze źródłami: [research/drag-and-drop.md](../research/drag-and-drop.md).

Rekomendacja: `@dnd-kit/react` 0.5.0 + `@dnd-kit/helpers`, z `useDraggable` / `useDroppable` i logiką upuszczenia w `onDragEnd`. Wersja przypięta dokładnie, bo biblioteka jest w 0.x.

Potwierdzone w dokumentacji:

- `@dnd-kit/react`: klawiatura, komunikaty dla czytników ekranu i dotyk włączone domyślnie; React 19 zadeklarowany; ostatni commit 2026-09-12.
- Klasyczne `@dnd-kit/core` 6.3.1 bez wydania od 2024-12; dokumentacja przeniesiona do `/legacy/`.
- Pragmatic drag and drop 4.0.0 zostawia dostępność aplikacji, a jego pakiet dostępności ciągnie zależności Atlaskit.
- React Aria Components 1.21.1 ma najpełniejszą obsługę klawiatury — rezerwa, gdyby dostępność stała się priorytetem.
- Żadna biblioteka nie ma gotowej zamiany dwóch kafelków między kontenerami ani limitu pojemności; są prymitywy blokowania (`accept`, `disabled`).
- shadcn/ui ma oficjalną instrukcję dla TanStack Start (`pnpm dlx shadcn@latest init -t start`). Otwarty błąd #11015 przy Tailwind v4 z presetem; rezerwą jest instalacja ręczna.

Wnioski niepotwierdzone, do sprawdzenia w prototypie tablicy:

- Zamiana między slotami i limit pojemności to kilka linii własnego kodu w `onDragEnd`; regułę pojemności sprawdza też serwer.
- Połączenie `useDraggable` i `useDroppable` na jednym kafelku (cel zamiany).
- Ruch klawiaturą w dnd-kit jest oparty na pikselach — dojście do odległego slotu może być uciążliwe.
- Domyślne komunikaty dnd-kit są po angielsku i wymagają nadpisania.
