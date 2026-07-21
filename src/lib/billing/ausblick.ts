import { berechneBrutto, berechneNettoAusBrutto } from "@/lib/steuer";

// Ausblick auf Aenderungen ab der naechsten Abrechnungsperiode, der bei der
// Pruefung einer Jahresrechnung erfasst wird: neue Strompreise (mit Grund)
// und/oder neuer monatlicher Abschlag. Wird als JSON an der Rechnung
// gespeichert, auf dem PDF ausgewiesen und bei Freigabe ins Mietprofil
// uebernommen.

export interface AusblickPreis {
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  grund: string;
}

export interface AusblickAbschlag {
  bruttoBetrag: number;
  steuersatzId: string;
}

export interface AusblickDaten {
  gueltigAb: string; // ISO (YYYY-MM-DD)
  preis: AusblickPreis | null;
  abschlag: AusblickAbschlag | null;
}

/** Robustes Parsen des an der Rechnung gespeicherten Ausblick-JSON. */
export function parseAusblick(json: unknown): AusblickDaten | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const gueltigAb = typeof o.gueltigAb === "string" ? o.gueltigAb : null;
  if (!gueltigAb) return null;

  let preis: AusblickPreis | null = null;
  const p = o.preis as Record<string, unknown> | null | undefined;
  if (p && typeof p === "object" && Number.isFinite(Number(p.arbeitspreisNetto)) && typeof p.arbeitspreisSteuersatzId === "string") {
    const grundpreisNetto = p.grundpreisNetto == null ? null : Number(p.grundpreisNetto);
    preis = {
      arbeitspreisNetto: Number(p.arbeitspreisNetto),
      arbeitspreisSteuersatzId: p.arbeitspreisSteuersatzId,
      grundpreisNetto: grundpreisNetto != null && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
      grundpreisSteuersatzId: typeof p.grundpreisSteuersatzId === "string" ? p.grundpreisSteuersatzId : null,
      grund: typeof p.grund === "string" ? p.grund : "",
    };
  }

  let abschlag: AusblickAbschlag | null = null;
  const a = o.abschlag as Record<string, unknown> | null | undefined;
  if (a && typeof a === "object" && Number.isFinite(Number(a.bruttoBetrag)) && typeof a.steuersatzId === "string") {
    abschlag = { bruttoBetrag: Number(a.bruttoBetrag), steuersatzId: a.steuersatzId };
  }

  if (!preis && !abschlag) return null;
  return { gueltigAb, preis, abschlag };
}

/** Fuer die PDF-Darstellung aufbereiteter Ausblick: Brutto-Preise + formatiertes Datum. */
export interface AusblickPdf {
  gueltigAb: Date;
  preis: { arbeitspreisBrutto: number; grundpreisBrutto: number | null; grund: string } | null;
  abschlagBrutto: number | null;
}

/** Rechnet die Netto-Preise des Ausblicks in Brutto um (fuer den PDF-Ausweis). */
export function ausblickFuerPdf(
  ausblick: AusblickDaten,
  prozentsatzFuer: (steuersatzId: string) => number | null,
): AusblickPdf {
  let preis: AusblickPdf["preis"] = null;
  if (ausblick.preis) {
    const apSatz = prozentsatzFuer(ausblick.preis.arbeitspreisSteuersatzId) ?? 0;
    const arbeitspreisBrutto = berechneBrutto(ausblick.preis.arbeitspreisNetto, apSatz).bruttoBetrag;
    let grundpreisBrutto: number | null = null;
    if (ausblick.preis.grundpreisNetto != null && ausblick.preis.grundpreisSteuersatzId) {
      const gpSatz = prozentsatzFuer(ausblick.preis.grundpreisSteuersatzId) ?? 0;
      grundpreisBrutto = berechneBrutto(ausblick.preis.grundpreisNetto, gpSatz).bruttoBetrag;
    }
    preis = { arbeitspreisBrutto, grundpreisBrutto, grund: ausblick.preis.grund };
  }
  return {
    gueltigAb: new Date(ausblick.gueltigAb),
    preis,
    abschlagBrutto: ausblick.abschlag ? ausblick.abschlag.bruttoBetrag : null,
  };
}

// Re-Export der Betragsumrechnung, damit Aufrufer (Freigabe) den Abschlag-Netto
// aus dem Brutto ableiten koennen, ohne steuer.ts direkt zu kennen.
export { berechneNettoAusBrutto };
