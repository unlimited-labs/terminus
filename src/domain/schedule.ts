/** Slot do wylosowania: bez zespołu i jeszcze się nie zaczął (plansza, losowanie, tablica). */
export function isFreeSlot(slot: { startsAt: Date }, taken: boolean, now: Date) {
  return !taken && slot.startsAt > now
}

/** Zapisy otwarte: bez daty startu albo start już minął. */
export function isEnrollmentOpen(opensAt: Date | null | undefined, now: Date) {
  return !opensAt || opensAt <= now
}
