// Gemeinsame Formatierungs-Helfer fuer die Brief-PDFs (Willkommensbrief,
// Onboarding-Anschreiben, Vertrag, SEPA-Mandat). Bewusst zentral, damit alle
// Briefe Betraege/Datumsangaben identisch darstellen.

/** Geldbetrag mit zwei Nachkommastellen (z.B. Grundpreis/Abschlag €/Monat). */
export function fmtEuro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Arbeitspreis €/kWh mit vier Nachkommastellen (z.B. "0,3245"). */
export function fmtPreisKwh(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/** Datum strikt als TT.MM.JJJJ (zweistellig, mit fuehrenden Nullen). */
export function fmtDate(d: Date): string {
  const tag = String(d.getDate()).padStart(2, "0");
  const monat = String(d.getMonth() + 1).padStart(2, "0");
  return `${tag}.${monat}.${d.getFullYear()}`;
}

/** Prozentwert mit einer Nachkommastelle (z.B. "12,5"). */
export function fmtProzent(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
