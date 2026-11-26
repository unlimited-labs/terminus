/** Slot do wylosowania: bez zespołu i jeszcze się nie zaczął (plansza, losowanie, tablica). */
export function isFreeSlot(slot: { startsAt: Date }, taken: boolean, now: Date) {
  return !taken && slot.startsAt > now
}

/** Slot harmonogramu z zespołem: zajęty = ma kogoś w zespole. */
export const isFreeTeamSlot = (slot: { startsAt: Date; team: unknown[] }, now: Date) =>
  isFreeSlot(slot, slot.team.length > 0, now)

/** Zapisy otwarte: bez daty startu albo start już minął. */
export function isEnrollmentOpen(opensAt: Date | null | undefined, now: Date) {
  return !opensAt || opensAt <= now
}

/** Ile ms do otwarcia zapisów (`null`, gdy otwarte), najwyżej tyle, ile przyjmie `setTimeout`. */
export function msUntilOpen(opensAt: Date | null | undefined, now: Date) {
  if (!opensAt || isEnrollmentOpen(opensAt, now)) return null
  return Math.min(opensAt.getTime() - now.getTime(), 2 ** 31 - 1)
}

/** Liczniki zaliczenia: zapisane indeksy, ocenieni (sam komentarz to nie ocena) i sloty do wylosowania. */
export function examCounts(
  exam: {
    people: { slotId: string | null; grade?: string | null }[]
    slots: { id: string; startsAt: Date }[]
  },
  now: Date,
) {
  const taken = new Set(exam.people.map((p) => p.slotId))
  const enrolled = exam.people.filter((p) => p.slotId !== null)
  return {
    enrolled: enrolled.length,
    graded: enrolled.filter((p) => p.grade != null).length,
    freeSlots: exam.slots.filter((s) => isFreeSlot(s, taken.has(s.id), now)).length,
  }
}

export type ExamPhase = "draft" | "scheduled" | "open" | "done"

/** Etap zaliczenia na liście prowadzącego: bez listy lub slotów, przed zapisami, w trakcie, po ostatnim slocie. */
export function examPhase(
  exam: { entries: number; lastSlotEnd: Date | null; opensAt: Date | null },
  now: Date,
): ExamPhase {
  if (!exam.entries || !exam.lastSlotEnd) return "draft"
  if (exam.lastSlotEnd < now) return "done"
  return isEnrollmentOpen(exam.opensAt, now) ? "open" : "scheduled"
}

/** „Imię Nazwisko” osoby z listy. */
export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`

/** „Imię Nazwisko (indeks)”, bez imienia sam indeks. */
export const personLabel = (p: { firstName: string; lastName: string; studentNumber: string }) =>
  p.firstName ? `${fullName(p)} (${p.studentNumber})` : p.studentNumber
