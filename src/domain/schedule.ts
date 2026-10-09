/** Slot do wylosowania: bez zespołu i jeszcze się nie zaczął (plansza, losowanie, tablica). */
export function isFreeSlot(slot: { startsAt: Date }, taken: boolean, now: Date) {
  return !taken && slot.startsAt > now
}

/** Zapisy otwarte: bez daty startu albo start już minął. */
export function isEnrollmentOpen(opensAt: Date | null | undefined, now: Date) {
  return !opensAt || opensAt <= now
}

/** Liczniki zaliczenia: zapisane indeksy i sloty, które da się jeszcze wylosować. */
export function examCounts(
  exam: { people: { slotId: string | null }[]; slots: { id: string; startsAt: Date }[] },
  now: Date,
) {
  const taken = new Set(exam.people.map((p) => p.slotId))
  return {
    enrolled: exam.people.filter((p) => p.slotId !== null).length,
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
