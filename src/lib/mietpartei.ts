export type Anrede = "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null | undefined;

const KOMBINIERENDE_DIAKRITIKA = /[̀-ͯ]/g;

/**
 * Reduziert ein einzelnes Namensteil auf reine Kleinbuchstaben/Ziffern (ohne
 * Trennzeichen), damit Namensteile beim Benutzernamen sauber mit „-" verbunden
 * werden koennen. Umlaute werden vereinfacht (ä→a, ö→o, ü→u), ß→ss.
 */
function slugNamensteil(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(KOMBINIERENDE_DIAKRITIKA, "")
    .replace(/[^a-z0-9]+/g, "");
}

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

/** Eine Person der Mietpartei (Hauptperson oder eine der weiteren Personen). */
export interface MietparteiPerson {
  anrede: Anrede;
  vorname: string;
  name: string;
}

/** Verbindet Teile natuerlichsprachlich: "A", "A und B", "A, B und C". */
function joinUnd(teile: string[]): string {
  const t = teile.filter(Boolean);
  if (t.length <= 1) return t[0] ?? "";
  return `${t.slice(0, -1).join(", ")} und ${t[t.length - 1]}`;
}

/** Anrede-Rohwert (z.B. aus JSON) auf einen gueltigen Anrede-Wert normalisieren. */
function normAnrede(v: unknown): Anrede {
  return v === "HERR" || v === "FRAU" || v === "FAMILIE" || v === "FIRMA" ? v : null;
}

// Eingabeform fuer die Namens-/Anredelogik: Hauptperson (anrede/vorname/name)
// plus weitere Personen. Neue Daten stehen in `weiterePersonen` (JSON-Array);
// die Legacy-Felder vorname2/name2/anrede2 werden nur als Fallback gelesen.
export interface MietparteiPersonenInput {
  anrede?: Anrede;
  vorname?: string | null;
  name?: string | null;
  firma?: string | null;
  vorname2?: string | null;
  name2?: string | null;
  anrede2?: Anrede;
  weiterePersonen?: unknown;
}

/** JSON-Array `weiterePersonen` robust in typisierte Personen wandeln. */
function parseWeiterePersonen(w: unknown): MietparteiPerson[] {
  if (!Array.isArray(w)) return [];
  return w
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        anrede: normAnrede(o.anrede),
        vorname: String(o.vorname ?? "").trim(),
        name: String(o.name ?? "").trim(),
      };
    })
    .filter((p) => p.vorname || p.name);
}

/**
 * Weitere Personen (ab Person 2) einer Mietpartei als typisierte Liste. Bevorzugt
 * das JSON-Feld `weiterePersonen`; ist es leer, greift der Legacy-Fallback auf die
 * einzelne zweite Person (vorname2/name2/anrede2).
 */
export function weiterePersonenDerMietpartei(m: MietparteiPersonenInput): MietparteiPerson[] {
  const ausJson = parseWeiterePersonen(m.weiterePersonen);
  if (ausJson.length > 0) return ausJson;
  if (m.vorname2?.trim() || m.name2?.trim()) {
    return [{ anrede: m.anrede2 ?? null, vorname: m.vorname2?.trim() ?? "", name: m.name2?.trim() ?? "" }];
  }
  return [];
}

/** Alle natuerlichen Personen der Mietpartei (Hauptperson zuerst, dann weitere). */
function alleNatuerlichenPersonen(m: MietparteiPersonenInput): MietparteiPerson[] {
  const p1: MietparteiPerson = {
    anrede: m.anrede ?? null,
    vorname: m.vorname?.trim() ?? "",
    name: m.name?.trim() ?? "",
  };
  return [p1, ...weiterePersonenDerMietpartei(m)];
}

/** Tragen ALLE Personen denselben (nicht-leeren) Nachnamen? -> Zusammenfassung als „Familie". */
function alleGleicherNachname(personen: MietparteiPerson[]): boolean {
  const namen = personen.map((p) => p.name.trim().toLowerCase()).filter(Boolean);
  if (namen.length < 2 || namen.length !== personen.length) return false;
  return namen.every((n) => n === namen[0]);
}

export function mietparteiAnzeigeName(m: MietparteiPersonenInput): string {
  const firma = m.firma?.trim();
  // Firmen werden in Briefen ueber den Firmennamen gefuehrt; ein optionaler
  // Ansprechpartner-Name (m.name/m.vorname) wird bewusst NICHT in den Adressaten
  // aufgenommen.
  if (firma) return firma;
  const personen = alleNatuerlichenPersonen(m);
  let person: string;
  if (personen.length > 1 && alleGleicherNachname(personen)) {
    // Gleicher Nachname -> "Vorname1, Vorname2 und Vorname3 Nachname".
    const vornamen = joinUnd(personen.map((p) => p.vorname.trim()).filter(Boolean));
    person = [vornamen, personen[0]?.name.trim() ?? ""].filter(Boolean).join(" ");
  } else {
    // Sonst -> "Vorname1 Name1, Vorname2 Name2 und …".
    person = joinUnd(personen.map((p) => personName(p.vorname, p.name)).filter(Boolean));
  }
  return person || "—";
}

/**
 * Basis für den Dashboard-Benutzernamen (ohne Eindeutigkeits-Suffix). Regeln:
 * - genau eine Person ODER mehrere Personen mit demselben Nachnamen →
 *   „vorname-nachname" (Vorname der Hauptperson + gemeinsamer Nachname);
 * - mehrere unterschiedliche Nachnamen → „nachname1-nachname2-…" (jeweils
 *   verschiedene Nachnamen, Reihenfolge wie erfasst, Duplikate zusammengefasst);
 * - reine Firma (keine natürlichen Personen) → Slug des Firmennamens.
 * Fällt alles weg, greift „mieter". Auf 40 Zeichen begrenzt.
 */
export function benutzernameBasis(m: MietparteiPersonenInput): string {
  const personen = alleNatuerlichenPersonen(m).filter((p) => p.vorname || p.name);
  let basis: string;
  if (personen.length === 0) {
    basis = slugNamensteil(m.firma ?? "");
  } else {
    const nachnamen = personen.map((p) => slugNamensteil(p.name)).filter(Boolean);
    const verschiedene = [...new Set(nachnamen)];
    if (verschiedene.length >= 2) {
      basis = verschiedene.join("-");
    } else {
      // Eine Person oder gemeinsamer Nachname → Vorname der Hauptperson + Nachname.
      const haupt = personen[0]!;
      basis = [slugNamensteil(haupt.vorname), slugNamensteil(haupt.name)].filter(Boolean).join("-");
    }
  }
  return basis.slice(0, 40) || "mieter";
}

/**
 * Kombiniert zwei Freitext-Namen (z.B. Vermieter-Ehepaar) als "Name1 und Name2".
 * Leere Teile werden weggelassen; ohne Namen wird null zurueckgegeben.
 */
export function kombiniereNamen(name1?: string | null, name2?: string | null): string | null {
  const teile = [name1?.trim(), name2?.trim()].filter(Boolean);
  return teile.length ? teile.join(" und ") : null;
}

/** Einzelne Vermieter:in-Nennung je Anrede (z.B. „Ihrer Vermieterin Anna Müller"). */
function vermieterEinzelPhrase(anrede: Anrede | undefined, name: string | undefined): string {
  if (anrede === "FRAU") return name ? `Ihrer Vermieterin ${name}` : "Ihrer Vermieterin";
  if (anrede === "HERR") return name ? `Ihrem Vermieter ${name}` : "Ihrem Vermieter";
  if (anrede === "FAMILIE") return name ? `Ihren Vermietern ${name}` : "Ihren Vermietern";
  return name || "Ihrer Vermieterin bzw. Ihrem Vermieter";
}

/**
 * Formuliert die Vermieter:in-Nennung fuer das Anschreiben abhaengig von der
 * Anrede, z.B. „Ihrer Vermieterin Anna Müller", „Ihrem Vermieter …", bei Firma
 * „der {Firma}". Bei zwei Vermieter:innen wird jede mit ihrer eigenen Anrede
 * genannt und mit „ und " verbunden („Ihrer Vermieterin A und Ihrem Vermieter B").
 * Ohne Anrede: nur der Name; ohne alles ein neutraler Fallback.
 */
export function vermieterAnredePhrase(v: {
  anrede?: Anrede;
  name?: string | null;
  firma?: string | null;
  anrede2?: Anrede;
  name2?: string | null;
}): string {
  const name = v.name?.trim();
  const firma = v.firma?.trim();
  if (v.anrede === "FIRMA") {
    const bez = firma || name;
    return bez ? `der ${bez}` : "Ihrer Vermietergesellschaft";
  }
  const name2 = v.name2?.trim();
  if (name2) {
    return `${vermieterEinzelPhrase(v.anrede, name)} und ${vermieterEinzelPhrase(v.anrede2, name2)}`;
  }
  return vermieterEinzelPhrase(v.anrede, name);
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

export function anredeSatz(m: MietparteiPersonenInput): string {
  if (m.anrede === "FIRMA") return anredeText("FIRMA");

  const personen = alleNatuerlichenPersonen(m);

  // Mehrere Personen: bei gleichem Nachnamen zusammengefasst als "Familie",
  // sonst getrennte Anreden (Damen zuerst), die weiteren kleingeschrieben
  // fortgesetzt ("…, sehr geehrter Herr …").
  if (personen.length > 1) {
    if (alleGleicherNachname(personen)) {
      return `${anredeText("FAMILIE")} ${personen[0]?.name.trim() ?? ""}`;
    }
    // Damen zuerst (stabil): Frauen behalten ihre Reihenfolge, dann die Uebrigen.
    const frauen = personen.filter((p) => p.anrede === "FRAU");
    const uebrige = personen.filter((p) => p.anrede !== "FRAU");
    const sortiert = [...frauen, ...uebrige];
    const segmente = sortiert.map((p, i) => {
      const roh = anredeSegment(p.anrede, p.name);
      return i === 0 ? roh : roh.charAt(0).toLowerCase() + roh.slice(1);
    });
    return segmente.join(", ");
  }

  const displayName = mietparteiAnzeigeName(m);
  if (m.anrede === "HERR" || m.anrede === "FRAU" || m.anrede === "FAMILIE") {
    const nachname = m.name?.trim() || m.firma?.trim() || displayName;
    return `${anredeText(m.anrede)} ${nachname}`;
  }
  return `Guten Tag ${displayName}`;
}

/**
 * Kurz-Anrede fuer das Anschriftenfeld (Fensterumschlag). Bei mehreren Personen
 * mit gleichem Nachnamen "Familie", sonst die Kurz-Anrede der ersten Person.
 */
export function empfaengerAnredeKurz(m: MietparteiPersonenInput): string {
  const personen = alleNatuerlichenPersonen(m);
  if (personen.length > 1 && alleGleicherNachname(personen)) return "Familie";
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

/**
 * Darf sich eine Mietpartei am Dashboard anmelden? Bewusst LOSER als
 * `isMietparteiEffectivelyAktiv`: Ein **zukünftiges Einzugsdatum blockiert die
 * Anmeldung NICHT** – ein frisch angelegter Onboarding-Zugang soll schon vor dem
 * Einzug funktionieren (Passwort setzen, Portal ansehen). Verlangt wird nur der
 * Status AKTIV; nach dem Auszug ist der Login gesperrt. Abrechnung und Polling
 * bleiben weiterhin an `isMietparteiEffectivelyAktiv` (inkl. Einzugsdatum) gebunden.
 */
export function darfMieterEinloggen(mietpartei: MietparteiStatusInput, now: Date = new Date()): boolean {
  if (mietpartei.status !== "AKTIV") return false;
  if (mietpartei.auszugsdatum && now > mietpartei.auszugsdatum) return false;
  return true;
}
