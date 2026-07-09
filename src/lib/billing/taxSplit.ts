import { subDays } from "date-fns";
import { berechneBrutto, getSteuersatzForDate, type SteuersatzLike } from "@/lib/steuer";

export interface Zeitraum {
  von: Date;
  bis: Date;
}

export interface RechnungspositionEntwurf {
  bezeichnung: string;
  nettoBetrag: number;
  steuersatzId: string;
  steuerBetrag: number;
  bruttoBetrag: number;
}

export function tageZwischen(von: Date, bis: Date): number {
  const MS_PRO_TAG = 1000 * 60 * 60 * 24;
  return Math.floor((bis.getTime() - von.getTime()) / MS_PRO_TAG) + 1;
}

/**
 * Zerlegt einen Zeitraum an allen Steuersatz-Stichtagen (gueltigAb), die
 * innerhalb des Zeitraums liegen, in lueckenlose Teilzeitraeume.
 */
export function ermittleTeilzeitraeume(zeitraum: Zeitraum, steuersaetze: SteuersatzLike[]): Zeitraum[] {
  const stichtage = [...new Set(steuersaetze.map((s) => s.gueltigAb.getTime()))]
    .map((t) => new Date(t))
    .filter((d) => d > zeitraum.von && d <= zeitraum.bis)
    .sort((a, b) => a.getTime() - b.getTime());

  if (stichtage.length === 0) return [zeitraum];

  const teilzeitraeume: Zeitraum[] = [];
  let start = zeitraum.von;
  for (const stichtag of stichtage) {
    teilzeitraeume.push({ von: start, bis: subDays(stichtag, 1) });
    start = stichtag;
  }
  teilzeitraeume.push({ von: start, bis: zeitraum.bis });
  return teilzeitraeume;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

/**
 * Teilt einen Netto-Gesamtbetrag für einen Zeitraum an Steuersatz-Stichtagen
 * auf (taggenau proportional zur Tageszahl je Teilzeitraum - pragmatische,
 * im Auftrag so vorgegebene Annahme) und berechnet je Teilzeitraum den zum
 * jeweiligen Leistungsdatum gültigen Steuerbetrag/Bruttobetrag.
 */
export function splitteNachSteuersatz(
  bezeichnung: string,
  gesamtNetto: number,
  zeitraum: Zeitraum,
  steuersaetze: SteuersatzLike[],
): RechnungspositionEntwurf[] {
  const teilzeitraeume = ermittleTeilzeitraeume(zeitraum, steuersaetze);
  const gesamtTage = tageZwischen(zeitraum.von, zeitraum.bis);

  return teilzeitraeume.map((teil) => {
    const tage = tageZwischen(teil.von, teil.bis);
    const anteilNetto = gesamtTage === 0 ? 0 : Math.round(((gesamtNetto * tage) / gesamtTage) * 100) / 100;
    const satz = getSteuersatzForDate(steuersaetze, teil.von);
    if (!satz) {
      throw new Error(`Kein gültiger Steuersatz für den ${formatDate(teil.von)} hinterlegt.`);
    }
    const { steuerBetrag, bruttoBetrag } = berechneBrutto(anteilNetto, satz.prozentsatz);
    const suffix = teilzeitraeume.length > 1 ? ` (${formatDate(teil.von)} – ${formatDate(teil.bis)})` : "";

    return {
      bezeichnung: bezeichnung + suffix,
      nettoBetrag: anteilNetto,
      steuersatzId: satz.id,
      steuerBetrag,
      bruttoBetrag,
    };
  });
}
