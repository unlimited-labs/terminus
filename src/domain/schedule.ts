/** Slot do wylosowania: bez zespołu i jeszcze się nie zaczął (plansza, losowanie, tablica). */
export function isFreeSlot(slot: { startsAt: Date }, teamSize: number, now: Date) {
  return teamSize === 0 && slot.startsAt > now
}

/** Zapisy otwarte: bez daty startu albo start już minął. */
export function isEnrollmentOpen(opensAt: Date | null | undefined, now: Date) {
  return !opensAt || opensAt <= now
}
