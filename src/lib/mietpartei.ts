/**
 * Anzeige-Bezeichner einer Mietpartei. Firmen werden ueber den Firmennamen
 * gefuehrt (ggf. mit Ansprechpartner in Klammern), Privatpersonen ueber den
 * Namen. Bewusst zentral, weil "name" leer sein darf, wenn "firma" gesetzt ist.
 */
export function mietparteiAnzeigeName(m: { name?: string | null; firma?: string | null }): string {
  const firma = m.firma?.trim();
  const name = m.name?.trim();
  if (firma && name) return `${firma} (${name})`;
  return firma || name || "—";
}

/** Anrede-Text (z.B. "Sehr geehrte Familie …"). Leer, wenn keine Anrede. */
export function anredeText(anrede: "HERR" | "FRAU" | "FAMILIE" | null | undefined): string {
  switch (anrede) {
    case "HERR":
      return "Sehr geehrter Herr";
    case "FRAU":
      return "Sehr geehrte Frau";
    case "FAMILIE":
      return "Sehr geehrte Familie";
    default:
      return "";
  }
}

/** Kurze Anrede fuer Adressfeld/Empfaenger (z.B. "Herr", "Familie"). */
export function anredeKurz(anrede: "HERR" | "FRAU" | "FAMILIE" | null | undefined): string {
  switch (anrede) {
    case "HERR":
      return "Herr";
    case "FRAU":
      return "Frau";
    case "FAMILIE":
      return "Familie";
    default:
      return "";
  }
}

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
