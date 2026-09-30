/** Slot do wylosowania: bez zespołu i jeszcze się nie zaczął. */
export function isFreeSlot(slot: { startsAt: Date; team: unknown[] }, now: Date) {
  return slot.team.length === 0 && slot.startsAt > now
}
