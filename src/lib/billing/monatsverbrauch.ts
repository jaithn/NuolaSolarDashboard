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

  // Die Monate sind unabhaengig voneinander - parallel statt sequenziell
  // berechnen (SQLite bedient parallele Lesezugriffe problemlos). Reduziert
  // die Dashboard-Ladezeit von 13 sequenziellen Runden auf eine.
  return Promise.all(
    Array.from({ length: anzahlMonate }, (_, idx) => {
      const i = anzahlMonate - 1 - idx;
      const monatsStart = startOfMonth(subMonths(now, i));
      const monatsEnde = endOfMonth(monatsStart);
      return verbrauchKwhFuerEinheit(einheitId, { von: monatsStart, bis: monatsEnde }).then((verbrauchKwh) => ({
        monat: format(monatsStart, "yyyy-MM"),
        label: format(monatsStart, "MMM yyyy"),
        verbrauchKwh: Math.round(verbrauchKwh * 100) / 100,
      }));
    }),
  );
}
