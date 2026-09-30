# Biblioteka przeciągnij-i-upuść + shadcn/ui w TanStack Start

Ticket: `issues/03-biblioteka-przeciagnij-i-upusc.md`. Stan na 2026-09-30.

Oznaczenia: **[P]** = potwierdzone w źródle pierwotnym (link obok), **[W]** = wniosek własny, niepotwierdzony wprost w dokumentacji.

## Rekomendacja

**`@dnd-kit/react` (+ `@dnd-kit/helpers`)**, na prymitywach `useDraggable` + `useDroppable`, z logiką upuszczenia w `onDragEnd`.

- Powód: jedyna z porównanych opcji, w której klawiatura, komunikaty dla czytnika ekranu, dotyk i blokada celu upuszczenia są dostarczane przez bibliotekę i włączone domyślnie, przy zadeklarowanej zgodności z React 19. Pragmatic DnD wprost przerzuca dostępność na aplikację.
- Główna wada: wersja 0.x (0.5.0), bez wydania 1.0, cztery wydania minor w 2026 r. Trzeba przypiąć dokładną wersję i liczyć się ze zmianami API.
- Druga wada: zamiany kafelków między slotami biblioteka nie robi sama (szczegóły w sekcji 2). To kilka linii własnego kodu w `onDragEnd`.

## 1. Porównanie

| | `@dnd-kit/react` (nowe) | `@dnd-kit/core` (klasyczne) | Pragmatic drag and drop | React Aria Components (DnD) | `@hello-pangea/dnd` |
|---|---|---|---|---|---|
| Najnowsza wersja [P] | 0.5.0, 2026-06-11 | core 6.3.1, 2024-12-05; sortable 10.0.0, 2024-12-04 | 4.0.0, 2026-09-24 | 1.21.1, 2026-09-04 | 18.0.1, 2025-02-09 |
| Aktywność repo [P] | ostatni commit 2026-09-12; beta 0.5.1 z 2026-09-12 | to samo repo, brak wydań od 12.2024 | commity codziennie (lustro monorepo Atlassiana) | commity codziennie | ostatni commit 2026-02-13 (porządki), ostatnie wydanie 02.2025 |
| React 19 (peerDependencies) [P] | `^18.0.0 \|\| ^19.0.0` | `>=16.8.0` (formalnie obejmuje 19) | rdzeń bez zależności od Reacta; pakiet a11y: `^18.2.0 \|\| ^19.0.0` | `... \|\| ^19.0.0-rc.1` | `^18.0.0 \|\| ^19.0.0` |
| Klawiatura | wbudowana, domyślna [P] | wbudowana (KeyboardSensor) [W, z pamięci, strona legacy niepobrana] | brak w rdzeniu, buduje aplikacja [P] | wbudowana [P] | wbudowana [W] |
| Czytnik ekranu | wtyczka Accessibility domyślnie: ARIA + live region [P] | wbudowane komunikaty [W] | pakiet `live-region`, komunikaty pisze aplikacja [P] | wbudowane [P] | wbudowane [W] |
| Dotyk | PointerSensor domyślnie, dla dotyku opóźnienie 250 ms / tolerancja 5 px [P] | sensory Pointer/Touch [W] | deklarowane „iOS and Android" [P] | deklarowane „mouse and touch" [P] | tak [W] |

Źródła wersji, dat i peerDependencies: rejestr npm (`https://registry.npmjs.org/<pakiet>`), np.
<https://registry.npmjs.org/@dnd-kit/react>, <https://registry.npmjs.org/@dnd-kit/core>,
<https://registry.npmjs.org/@atlaskit/pragmatic-drag-and-drop>,
<https://registry.npmjs.org/react-aria-components>, <https://registry.npmjs.org/@hello-pangea/dnd>.
Aktywność: API GitHuba (`/repos/<repo>` i `/commits`) dla
<https://github.com/clauderic/dnd-kit>, <https://github.com/atlassian/pragmatic-drag-and-drop>,
<https://github.com/hello-pangea/dnd>, <https://github.com/adobe/react-spectrum>.

### dnd-kit: szczegóły

- [P] Wydanie 0.5.0 (2026-06-11) objęło wszystkie pakiety nowej linii (`abstract`, `dom`, `react`, `helpers`, ...): <https://github.com/clauderic/dnd-kit/releases>
- [P] Dokumentacja klasycznych pakietów jest przeniesiona pod `/legacy/` i oznaczona w nawigacji jako „Legacy": <https://dndkit.com/legacy/presets/sortable/overview>. Istnieje przewodnik migracji do `@dnd-kit/react`: <https://dndkit.com/react/guides/migration>
- [P] `@dnd-kit/core` nie ma flagi `deprecated` w npm (rejestr npm, wersja 6.3.1).
- [W] Klasyczna linia jest w praktyce zamrożona (brak wydań od grudnia 2024, docs jako legacy). Nie znalazłem oficjalnego zdania „nieutrzymywane".
- [P] Wtyczka Accessibility jest dołączana domyślnie; ustawia atrybuty ARIA, instrukcje dla czytnika i ogłasza zdarzenia przez live region; komunikaty można nadpisać przez `Accessibility.configure()`: <https://dndkit.com/extend/plugins/accessibility>. Domyślne komunikaty są po angielsku, więc [W] dla polskiego interfejsu trzeba je podmienić.
- [P] KeyboardSensor domyślnie: Spacja/Enter podnosi, strzałki przesuwają (10 px, z Shift 50 px), Spacja/Enter upuszcza, Escape anuluje: <https://dndkit.com/extend/sensors/keyboard-sensor>
- [P] PointerSensor obsługuje mysz, dotyk i pióro, domyślnie włączony: <https://dndkit.com/extend/sensors/pointer-sensor>
- [W] Klawiatura przesuwa kafelek o piksele, a nie „do następnego slotu". Przy tablicy z dziesiątkami slotów dojście klawiaturą do odległego slotu będzie żmudne; warto to sprawdzić w prototypie.

### Pragmatic drag and drop: szczegóły

- [P] README: „Works everywhere: Full feature support in Firefox, Safari, and Chrome, iOS and Android", niezależne od frameworka, rdzeń ~4,7 kB, oparte na natywnym HTML drag and drop; repo to jednostronne lustro, bez przyjmowania kodu z zewnątrz: <https://github.com/atlassian/pragmatic-drag-and-drop>
- [P] „The core package does not enable accessible controls automatically, as there is no one pattern that works well for all situations." Zalecany wzorzec to osobne, widoczne kontrolki (przycisk/menu z akcjami „przenieś do...") zamiast sterowania strzałkami, plus komunikaty przez pakiet `live-region`: <https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines>
- [P] Pakiet `@atlaskit/pragmatic-drag-and-drop-react-accessibility` 3.2.4 zależy od `@atlaskit/tokens`, `@atlaskit/primitives`, `@atlaskit/icon`, `@emotion/react` (rejestr npm: <https://registry.npmjs.org/@atlaskit/pragmatic-drag-and-drop-react-accessibility/latest>).
- [W] Czyli obok shadcn/ui wchodziłby kawałek systemu projektowego Atlassiana albo własnoręcznie pisane menu akcji. To sprzeczne z założeniem „biblioteki zamiast własnego kodu".
- [P] 4.0.0 usuwa przestarzałe ścieżki importu; od 3.0.0 obowiązują nowe (np. `.../utils/reorder`): <https://unpkg.com/@atlaskit/pragmatic-drag-and-drop@4.0.0/CHANGELOG.md>. [W] Przykłady w sieci sprzed 3.0 mogą mieć nieaktualne importy.
- Nie udało się potwierdzić w źródle, jak dokładnie zachowuje się dotyk (np. długie przytrzymanie wymagane przez natywny DnD na telefonach). Poza deklaracją z README brak danych.

### Inne opcje

- React Aria Components [P]: „mouse and touch interactions, and full keyboard and screen reader accessibility"; klawiatura: Enter rozpoczyna, Tab przechodzi po celach upuszczenia, Enter upuszcza; działa w ListBox, GridList, Tree, Table: <https://react-aria.adobe.com/dnd>. [W] Najmocniejsza dostępność (nawigacja klawiaturą po celach, a nie po pikselach), ale DnD jest związany z komponentami-kolekcjami React Aria; tablica slotów jako wiele GridList to więcej dopasowywania do shadcn/ui. Sensowna alternatywa, jeśli dostępność klawiaturowa okaże się priorytetem.
- `@hello-pangea/dnd` [P wersja/daty]: brak wydania od 02.2025. [W] Model „listy z wstawianiem", bez upuszczania na element; nie pasuje do zamiany.
- `react-dnd` [P]: ostatnie wydanie 16.0.1 z 2022-04-19 (<https://registry.npmjs.org/react-dnd>). Odpada.
- `swapy` [P]: 1.0.5 z 2025-01-19 (<https://registry.npmjs.org/swapy>). [W] Nastawione na zamianę, ale bez wydań od ponad 1,5 roku; nie sprawdzałem dostępności.

## 2. Wzorce: zamiana i tablica z limitem pojemności

**Wiele kontenerów**

- [P] dnd-kit ma oficjalny przewodnik „Multiple sortable lists": `useSortable` z `group`, kolumny przez `useDroppable` z `collisionPriority: CollisionPriority.Low`, stan aktualizowany helperem `move` w `onDragOver`, cofnięcie przy `event.canceled`: <https://dndkit.com/react/guides/multiple-sortable-lists>
- [P] Pragmatic DnD ma przykład tablicy (kolumny + karty): <https://atlassian.design/components/pragmatic-drag-and-drop/examples>
- [P] React Aria: upuszczanie między kolekcjami (`onInsert`, `onRootDrop`) i na element (`onItemDrop`): <https://react-aria.adobe.com/dnd>

**Zamiana dwóch elementów**

- [P] `@dnd-kit/helpers` eksportuje `swap(items, event)` i `arraySwap(array, from, to)`: <https://unpkg.com/@dnd-kit/helpers@0.5.0/README.md>
- [P] W kodzie helpera zamiana (`arraySwap`) jest stosowana tylko wtedy, gdy oba elementy są w tej samej grupie. Gdy grupy są różne, `swap` robi to samo co `move`: usuwa element ze źródła i wstawia do celu, bez wymiany: <https://github.com/clauderic/dnd-kit/blob/main/packages/helpers/src/move.ts>
- [P] Przewodnik po wielu listach nie wspomina o zamianie ani o limicie pojemności (<https://dndkit.com/react/guides/multiple-sortable-lists>); strona `useSortable` też nie: <https://dndkit.com/react/hooks/use-sortable>
- [P] Klasyczna linia ma `rectSwappingStrategy` („Use this strategy to achieve swappable functionality"): <https://dndkit.com/legacy/presets/sortable/overview>. [W] To strategia animacji w obrębie sortowalnej listy, nie gotowa zamiana między kontenerami.
- [P] Pragmatic DnD: w liście pakietów opcjonalnych i przykładów nie ma nic o zamianie: <https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages>
- **Wniosek [W]:** żadna z bibliotek nie ma udokumentowanego wzorca „upuść kafelek na kafelek w innym slocie = zamiana". W każdej trzeba to napisać samemu: w `onDragEnd` sprawdzić, czy cel to kafelek, i wymienić dwa identyfikatory w stanie (kilka linii). Sloty nie mają kolejności wewnętrznej, więc [W] preset sortowalny (`useSortable`, przestawianie w trakcie przeciągania) jest tu zbędny, a nawet przeszkadza; wystarczą `useDraggable` na kafelku oraz `useDroppable` na kafelku i na slocie. Dokumentacja nie potwierdza ani nie wyklucza użycia obu hooków na jednym elemencie (<https://dndkit.com/react/hooks/use-draggable>); do sprawdzenia w prototypie.

**Limit pojemności / odrzucenie upuszczenia**

- [P] Żadna biblioteka nie dokumentuje „limitu pojemności" jako wzorca. Są za to mechanizmy blokady celu:
  - dnd-kit `useDroppable`: `accept` (typ, lista typów lub predykat dostający przeciągany element) oraz `disabled`: <https://dndkit.com/react/hooks/use-droppable>
  - Pragmatic DnD: `canDrop()` („used to conditionally block dropping on a drop target"): <https://atlassian.design/components/pragmatic-drag-and-drop/core-package/drop-targets>
  - React Aria: `shouldAcceptItemDrop()`, `getDropOperation()`: <https://react-aria.adobe.com/dnd>
- [W] W dnd-kit pełny slot = `disabled: true` na slocie (lub predykat `accept`), przy czym kafelki w pełnym slocie pozostają celami, żeby zamiana dalej działała. Regułę pojemności i tak trzeba powtórzyć w `onDragEnd` oraz po stronie serwera, bo interfejs nie jest granicą zaufania.

**Skala (dziesiątki slotów, 100+ kafelków)**

- Nie znalazłem w źródłach pierwotnych pomiarów dla żadnej z bibliotek. [W] Ta skala jest mała dla każdej z nich; wirtualizacja niepotrzebna.

## 3. shadcn/ui + TanStack Start

- [P] Jest oficjalny przewodnik instalacji. Nowy projekt: `pnpm dlx shadcn@latest init -t start`; istniejący: `pnpm dlx shadcn@latest init`; komponenty: `pnpm dlx shadcn@latest add <nazwa>`. Uwaga z przewodnika: przy tworzeniu projektu przez TanStack CLI nie wybierać dodatku `shadcn` („Do not add the `shadcn` add-on when prompted"), tylko skonfigurować osobno; TanStack CLI sam ustawia Tailwind CSS i alias `@/*`: <https://ui.shadcn.com/docs/installation/tanstack>
- [P] CLI `shadcn` 4.21.0, 2026-09-04: <https://registry.npmjs.org/shadcn>
- [P] Dawny błąd „We could not detect a supported framework" (po zmianie nazwy pakietu na `@tanstack/react-start`) jest zamknięty: <https://github.com/shadcn-ui/ui/issues/7219>
- [P] Otwarte zgłoszenia:
  - #11015 (2026-06-25): `shadcn init --template start` w projekcie TanStack Start z Tailwind v4 i presetem pyta o `app/globals.css` i `tailwind.config.js`, kończy się `ENOENT`. Poprawka PR #11021 jest otwarta, niescalona (stan z API GitHuba, ostatnia zmiana 2026-06-26). <https://github.com/shadcn-ui/ui/issues/11015>
  - #10938 (2026-06-14): po `add --all` notatka komponentu tooltip wyświetla się podwójnie i odsyła do `app/layout.tsx` (konwencja Next.js). Kosmetyczne. <https://github.com/shadcn-ui/ui/issues/10938>
  - #6689 (2025-02-19): alias ścieżek wymagał nieudokumentowanych zmian. <https://github.com/shadcn-ui/ui/issues/6689>
- [W] Ocena: działa, ale nie „bez przeszkód". #11015 to zgłoszenie jednego użytkownika bez odpowiedzi opiekunów i nie wiem, czy nadal występuje w 4.21.0. Przy zakładaniu projektu trzeba sprawdzić, czy `components.json` wskazuje na istniejący plik CSS; w razie problemu jest instalacja ręczna (<https://ui.shadcn.com/docs/installation/manual>).
- [W] shadcn/ui nie ma własnego komponentu drag-and-drop, więc wybór biblioteki DnD jest od niego niezależny; kafelki i sloty to zwykłe elementy ostylowane Tailwindem.

## Czego nie sprawdziłem

- Nic nie było instalowane ani uruchamiane; wszystkie twierdzenia o zachowaniu pochodzą z dokumentacji i kodu źródłowego.
- Dostępność klasycznego `@dnd-kit/core` i `@hello-pangea/dnd` podana z pamięci (strona legacy sensorów zwróciła 404).
- Zachowanie dotyku w Pragmatic DnD na telefonach.
- Łączenie `useDraggable` i `useDroppable` na jednym elemencie w `@dnd-kit/react` 0.5.0.
