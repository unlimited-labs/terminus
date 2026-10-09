/**
 * Lista do wysłania z formularza: wybrana, jeśli wciąż istnieje; przy jednej liście (pole wyboru
 * ukryte) ta jedna; inaczej pusto — serwer albo schemat poprosi o wybór.
 */
export function currentRosterId(rosters: { id: string }[], chosen: string) {
  if (rosters.some((r) => r.id === chosen)) return chosen
  return rosters.length === 1 ? rosters[0]!.id : ""
}

/** Przy kilku listach widok pokazuje, do której należy osoba albo slot. */
export const hasManyRosters = (rosters: readonly unknown[]) => rosters.length > 1

export const rosterNames = (rosters: { id: string; name: string }[]) =>
  new Map(rosters.map((r) => [r.id, r.name]))
