import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { verbrauchKwhFuerEinheit } from "./consumption";

export interface Monatsverbrauch {
  monat: string; // "yyyy-MM"
  label: string; // "Jun 2026"
  verbrauchKwh: number;
}

/** Verbrauch der letzten `anzahlMonate` Kalendermonate (inkl. aktuellem Monat), aeltester zuerst. */
export async function getMonatsverbraeuche(einheitId: string, anzahlMonate = 12): Promise<Monatsverbrauch[]> {
  const now = new Date();
  const monate: Monatsverbrauch[] = [];

  for (let i = anzahlMonate - 1; i >= 0; i--) {
    const monatsStart = startOfMonth(subMonths(now, i));
    const monatsEnde = endOfMonth(monatsStart);
    const verbrauchKwh = await verbrauchKwhFuerEinheit(einheitId, { von: monatsStart, bis: monatsEnde });
    monate.push({
      monat: format(monatsStart, "yyyy-MM"),
      label: format(monatsStart, "MMM yyyy"),
      verbrauchKwh: Math.round(verbrauchKwh * 100) / 100,
    });
  }

  return monate;
}
