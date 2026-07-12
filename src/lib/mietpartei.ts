export type Anrede = "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null | undefined;

/**
 * Anzeige-Bezeichner einer Mietpartei. Firmen werden ueber den Firmennamen
 * gefuehrt (ggf. mit Ansprechpartner in Klammern), Privatpersonen ueber
 * "Vorname Name". Bewusst zentral, weil "name" leer sein darf, wenn "firma"
 * gesetzt ist.
 */
export function mietparteiAnzeigeName(m: { vorname?: string | null; name?: string | null; firma?: string | null }): string {
  const firma = m.firma?.trim();
  const person = [m.vorname?.trim(), m.name?.trim()].filter(Boolean).join(" ");
  if (firma && person) return `${firma} (${person})`;
  return firma || person || "—";
}

/** Anrede-Text (z.B. "Sehr geehrte Familie …"). Leer, wenn keine Anrede. */
export function anredeText(anrede: Anrede): string {
  switch (anrede) {
    case "HERR":
      return "Sehr geehrter Herr";
    case "FRAU":
      return "Sehr geehrte Frau";
    case "FAMILIE":
      return "Sehr geehrte Familie";
    case "FIRMA":
      return "Sehr geehrte Damen und Herren";
    default:
      return "";
  }
}

/** Kurze Anrede fuer Adressfeld/Empfaenger (z.B. "Herr", "Familie"). Bei Firmen leer. */
export function anredeKurz(anrede: Anrede): string {
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

/**
 * Vollstaendige Briefanrede-Zeile. Zentral, damit Rechnung und Willkommensbrief
 * identisch anreden. Bei FIRMA ohne Namen ("Sehr geehrte Damen und Herren"),
 * bei natuerlichen Personen "Sehr geehrte/r … {Nachname}", sonst neutral.
 */
export function anredeSatz(m: { anrede?: Anrede; vorname?: string | null; name?: string | null; firma?: string | null }): string {
  if (m.anrede === "FIRMA") return anredeText("FIRMA");
  const displayName = mietparteiAnzeigeName(m);
  if (m.anrede === "HERR" || m.anrede === "FRAU" || m.anrede === "FAMILIE") {
    const nachname = m.name?.trim() || m.firma?.trim() || displayName;
    return `${anredeText(m.anrede)} ${nachname}`;
  }
  return `Guten Tag ${displayName}`;
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
