interface MietparteiStatusInput {
  status: "AKTIV" | "INAKTIV";
  einzugsdatum: Date;
  auszugsdatum: Date | null;
}

/**
 * Effektiver Aktiv-Status: kombiniert den manuell gepflegten Status mit
 * Ein-/Auszugsdatum. Ein Mietverhältnis gilt automatisch als inaktiv vor dem
 * Einzugs- bzw. nach dem Auszugsdatum, unabhängig vom gespeicherten Status
 * (der Admin kann zusätzlich manuell vorzeitig auf INAKTIV setzen).
 */
export function isMietparteiEffectivelyAktiv(mietpartei: MietparteiStatusInput, now: Date = new Date()): boolean {
  if (mietpartei.status !== "AKTIV") return false;
  if (now < mietpartei.einzugsdatum) return false;
  if (mietpartei.auszugsdatum && now > mietpartei.auszugsdatum) return false;
  return true;
}
