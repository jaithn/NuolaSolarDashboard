// SEPA-Hilfsfunktionen.
//
// Die Glaeubiger-Identifikationsnummer (Creditor Identifier) wird der Firma
// einmalig zugeteilt und ist fuer ALLE Mandate identisch (FirmenStammdaten.
// glaeubigerId). Die Mandatsreferenz muss dagegen je Mandat eindeutig sein und
// wird deshalb pro Mietpartei aus deren Kundennummer abgeleitet.

/**
 * SEPA-Mandatsreferenz einer Mietpartei, abgeleitet aus ihrer Kundennummer.
 * Null, solange noch keine Kundennummer vergeben wurde (z.B. Interessent:innen).
 */
export function mandatsreferenz(kundennummer: number | null | undefined): string | null {
  if (kundennummer == null) return null;
  return `NUOLA-${kundennummer}`;
}
