export type Anrede = "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null | undefined;

/**
 * Anzeige-Bezeichner einer Mietpartei. Firmen werden ueber den Firmennamen
 * gefuehrt (ggf. mit Ansprechpartner in Klammern), Privatpersonen ueber
 * "Vorname Name". Bewusst zentral, weil "name" leer sein darf, wenn "firma"
 * gesetzt ist.
 */
/**
 * Postanschrift der Mietpartei für Briefe: nutzt die an der Mietpartei
 * hinterlegte Anschrift (Straße/PLZ/Ort), fällt je Feld auf die Objektadresse
 * zurück, wenn dort nichts erfasst ist.
 */
export function mietparteiPostanschrift(
  m: { anschrift?: string | null; anschriftPlz?: string | null; anschriftOrt?: string | null },
  objekt: { adresse: string; plz: string; ort: string },
): { strasse: string | null; plzOrt: string | null } {
  const strasse = (m.anschrift?.trim() || objekt.adresse || "").trim();
  const plz = (m.anschriftPlz?.trim() || objekt.plz || "").trim();
  const ort = (m.anschriftOrt?.trim() || objekt.ort || "").trim();
  return { strasse: strasse || null, plzOrt: `${plz} ${ort}`.trim() || null };
}

/** "Vorname Name" einer einzelnen Person (leere Teile werden weggelassen). */
function personName(vorname?: string | null, name?: string | null): string {
  return [vorname?.trim(), name?.trim()].filter(Boolean).join(" ");
}

/** Gibt es eine zweite Person (Vorname2 oder Name2 gesetzt)? */
function hatZweitePerson(m: { vorname2?: string | null; name2?: string | null }): boolean {
  return Boolean(m.vorname2?.trim() || m.name2?.trim());
}

/** Tragen beide Personen denselben Nachnamen? (Grundlage fuer die Zusammenfassung.) */
function gleicherNachname(m: { name?: string | null; name2?: string | null }): boolean {
  const n1 = m.name?.trim();
  const n2 = m.name2?.trim();
  return Boolean(n1 && n2 && n1.toLowerCase() === n2.toLowerCase());
}

export function mietparteiAnzeigeName(m: {
  vorname?: string | null;
  name?: string | null;
  firma?: string | null;
  vorname2?: string | null;
  name2?: string | null;
}): string {
  const firma = m.firma?.trim();
  let person: string;
  if (hatZweitePerson(m)) {
    if (gleicherNachname(m)) {
      // Gleicher Nachname -> "Vorname1 und Vorname2 Nachname".
      const vornamen = [m.vorname?.trim(), m.vorname2?.trim()].filter(Boolean).join(" und ");
      person = [vornamen, m.name?.trim()].filter(Boolean).join(" ");
    } else {
      // Unterschiedlicher Nachname -> "Vorname1 Name1 und Vorname2 Name2".
      person = [personName(m.vorname, m.name), personName(m.vorname2, m.name2)].filter(Boolean).join(" und ");
    }
  } else {
    person = personName(m.vorname, m.name);
  }
  if (firma && person) return `${firma} (${person})`;
  return firma || person || "—";
}

/**
 * Kombiniert zwei Freitext-Namen (z.B. Vermieter-Ehepaar) als "Name1 und Name2".
 * Leere Teile werden weggelassen; ohne Namen wird null zurueckgegeben.
 */
export function kombiniereNamen(name1?: string | null, name2?: string | null): string | null {
  const teile = [name1?.trim(), name2?.trim()].filter(Boolean);
  return teile.length ? teile.join(" und ") : null;
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
/** Anrede-Segment einer Person (z.B. "Sehr geehrter Herr Klein"); ohne Anrede "Guten Tag …". */
function anredeSegment(anrede: Anrede, nachname?: string | null): string {
  const nm = nachname?.trim() ?? "";
  const text = anredeText(anrede);
  return (text ? `${text} ${nm}` : `Guten Tag ${nm}`).trim();
}

export function anredeSatz(m: {
  anrede?: Anrede;
  vorname?: string | null;
  name?: string | null;
  firma?: string | null;
  vorname2?: string | null;
  name2?: string | null;
  anrede2?: Anrede;
}): string {
  if (m.anrede === "FIRMA") return anredeText("FIRMA");

  // Zwei Personen: bei gleichem Nachnamen zusammengefasst als "Familie",
  // sonst getrennte Anreden (Damen zuerst), die zweite kleingeschrieben
  // fortgesetzt ("…, sehr geehrter Herr …").
  if (hatZweitePerson(m)) {
    if (gleicherNachname(m)) {
      return `${anredeText("FAMILIE")} ${m.name?.trim()}`;
    }
    const p1 = { anrede: m.anrede, nachname: m.name };
    const p2 = { anrede: m.anrede2, nachname: m.name2 };
    // Damen zuerst: ist NUR die zweite Person eine Frau, wird sie vorangestellt.
    const [ersteP, zweiteP] = p2.anrede === "FRAU" && p1.anrede !== "FRAU" ? [p2, p1] : [p1, p2];
    const erste = anredeSegment(ersteP.anrede, ersteP.nachname);
    const zweiteRoh = anredeSegment(zweiteP.anrede, zweiteP.nachname);
    const zweite = zweiteRoh.charAt(0).toLowerCase() + zweiteRoh.slice(1);
    return `${erste}, ${zweite}`;
  }

  const displayName = mietparteiAnzeigeName(m);
  if (m.anrede === "HERR" || m.anrede === "FRAU" || m.anrede === "FAMILIE") {
    const nachname = m.name?.trim() || m.firma?.trim() || displayName;
    return `${anredeText(m.anrede)} ${nachname}`;
  }
  return `Guten Tag ${displayName}`;
}

/**
 * Kurz-Anrede fuer das Anschriftenfeld (Fensterumschlag). Bei zwei Personen mit
 * gleichem Nachnamen "Familie", sonst die Kurz-Anrede der ersten Person.
 */
export function empfaengerAnredeKurz(m: {
  anrede?: Anrede;
  name?: string | null;
  vorname2?: string | null;
  name2?: string | null;
}): string {
  if (hatZweitePerson(m) && gleicherNachname(m)) return "Familie";
  return anredeKurz(m.anrede);
}

interface MietparteiStatusInput {
  status: "INTERESSENT" | "AKTIV" | "INAKTIV";
  einzugsdatum: Date;
  auszugsdatum: Date | null;
}

/**
 * Effektiver Aktiv-Status: kombiniert den manuell gepflegten Status mit
 * Ein-/Auszugsdatum. Ein Mietverhältnis gilt automatisch als inaktiv vor dem
 * Einzugs- bzw. nach dem Auszugsdatum, unabhängig vom gespeicherten Status
 * (der Admin kann zusätzlich manuell vorzeitig auf INAKTIV setzen). Ein
 * Interessent (Status INTERESSENT) ist nie effektiv aktiv – kein Login, keine
 * Abrechnung, kein Polling.
 */
export function isMietparteiEffectivelyAktiv(mietpartei: MietparteiStatusInput, now: Date = new Date()): boolean {
  if (mietpartei.status !== "AKTIV") return false;
  if (now < mietpartei.einzugsdatum) return false;
  if (mietpartei.auszugsdatum && now > mietpartei.auszugsdatum) return false;
  return true;
}
