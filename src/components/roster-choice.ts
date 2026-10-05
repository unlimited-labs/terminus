/**
 * Lista do wysłania z formularza: wybrana, jeśli wciąż istnieje; przy jednej liście (pole wyboru
 * ukryte) ta jedna; inaczej pusto — serwer albo schemat poprosi o wybór.
 */
export function currentRosterId(rosters: { id: string }[], chosen: string) {
  if (rosters.some((r) => r.id === chosen)) return chosen
  return rosters.length === 1 ? rosters[0]!.id : ""
}
