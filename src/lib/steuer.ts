export interface SteuersatzLike {
  id: string;
  prozentsatz: number;
  gueltigAb: Date;
  gueltigBis: Date | null;
}

/** Ermittelt den zu einem Datum gültigen Steuersatz (den zuletzt begonnenen, dessen Gültigkeit das Datum abdeckt). */
export function getSteuersatzForDate<T extends SteuersatzLike>(steuersaetze: T[], date: Date): T | undefined {
  return steuersaetze
    .filter((s) => s.gueltigAb <= date && (!s.gueltigBis || s.gueltigBis >= date))
    .sort((a, b) => b.gueltigAb.getTime() - a.gueltigAb.getTime())[0];
}

/**
 * Netto-Betrag aus einem gegebenen Brutto-Betrag (inkl. MwSt.) und Steuersatz,
 * auf Cent gerundet. Gegenstueck zu berechneBrutto - genutzt, wenn ein Betrag
 * (z.B. der Abschlag) brutto erfasst wird, das Netto aber fuers MwSt.-Splitting
 * benoetigt wird.
 */
export function berechneNettoAusBrutto(bruttoBetrag: number, prozentsatz: number): number {
  return Math.round((bruttoBetrag / (1 + prozentsatz / 100)) * 100) / 100;
}

export function berechneBrutto(nettoBetrag: number, prozentsatz: number): { steuerBetrag: number; bruttoBetrag: number } {
  const steuerBetragExakt = nettoBetrag * (prozentsatz / 100);
  const steuerBetrag = Math.round(steuerBetragExakt * 100) / 100;
  const bruttoBetrag = Math.round((nettoBetrag + steuerBetragExakt) * 100) / 100;
  return { steuerBetrag, bruttoBetrag };
}
