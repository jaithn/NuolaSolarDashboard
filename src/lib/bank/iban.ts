import { isValidIBAN, electronicFormatIBAN, friendlyFormatIBAN } from "ibantools";
import { bankDataByIBAN } from "bankdata-germany";

// IBAN-Hilfen: Validierung (Modulo-97 via ibantools) und Ableitung von Bankname/
// BIC aus der IBAN (bankdata-germany buendelt das Bundesbank-Bankleitzahlen-
// Verzeichnis). Bewusst NUR serverseitig verwenden - der gebuendelte Datensatz
// ist gross und gehoert nicht in den Client-Bundle.

/** IBAN in die kanonische Form (Grossbuchstaben, ohne Leerzeichen). */
export function normalisiereIban(raw: string | null | undefined): string {
  return electronicFormatIBAN(raw ?? "") ?? "";
}

/** Gueltige IBAN (Format + Modulo-97-Pruefsumme)? */
export function istGueltigeIban(raw: string | null | undefined): boolean {
  const iban = normalisiereIban(raw);
  return iban.length > 0 && isValidIBAN(iban);
}

/** IBAN in lesbarer Gruppierung (4er-Bloecke) fuer die Anzeige. */
export function formatiereIban(raw: string | null | undefined): string {
  return friendlyFormatIBAN(normalisiereIban(raw)) ?? "";
}

export interface BankInfo {
  bankName: string;
  bic: string;
}

/**
 * Bankname + BIC aus einer (gueltigen) IBAN. Null, wenn die IBAN ungueltig ist
 * oder die Bankleitzahl nicht im Verzeichnis steht (z.B. auslaendische IBAN).
 */
export function bankAusIban(raw: string | null | undefined): BankInfo | null {
  const iban = normalisiereIban(raw);
  if (!isValidIBAN(iban)) return null;
  const d = bankDataByIBAN(iban);
  if (!d || !d.bankName) return null;
  return { bankName: d.bankName, bic: d.bic ?? "" };
}
