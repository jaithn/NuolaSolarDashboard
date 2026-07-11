import { prisma } from "@/lib/db";

export interface Zeitraum {
  von: Date;
  bis: Date;
}

// Ab dieser Luecke zwischen dem letzten Messwert vor einem Stichtag und dem
// Stichtag selbst gilt der Zaehlerstand als geschaetzt (Interpolation zum
// naechsten vorhandenen Messwert). Bei normalem Polling (alle paar Minuten)
// wird das nie ausgeloest; erst ein echter Ausfall (Geraet ueber einen Tag
// offline) fuehrt zur Schaetzung - gedeckt durch § 7 des Mietvertrags.
const SCHAETZ_LUECKE_MS = 25 * 60 * 60 * 1000;

interface Grenzwert {
  wert: number;
  geschaetzt: boolean;
}

/**
 * Zaehlerstand (Wh) einer Geraet/Phase zu einem Stichtag. Liegt am Stichtag
 * kein Messwert vor, aber davor UND danach welche, wird linear interpoliert
 * (und als geschaetzt markiert), sofern die Luecke groesser als
 * SCHAETZ_LUECKE_MS ist. Existieren nur Werte nach dem Stichtag (Geraet erst
 * spaeter installiert), wird der frueheste als Naeherung genutzt.
 */
async function zaehlerstandZumZeitpunkt(geraetId: string, phase: string, zeitpunkt: Date): Promise<Grenzwert | null> {
  const [vor, nach] = await Promise.all([
    prisma.messwert.findFirst({
      where: { geraetId, phase, timestamp: { lte: zeitpunkt } },
      orderBy: { timestamp: "desc" },
    }),
    prisma.messwert.findFirst({
      where: { geraetId, phase, timestamp: { gt: zeitpunkt } },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  if (vor && vor.timestamp.getTime() === zeitpunkt.getTime()) {
    return { wert: vor.energyWh, geschaetzt: false };
  }

  if (vor && nach) {
    const luecke = zeitpunkt.getTime() - vor.timestamp.getTime();
    if (luecke > SCHAETZ_LUECKE_MS) {
      const t0 = vor.timestamp.getTime();
      const t1 = nach.timestamp.getTime();
      const frac = t1 > t0 ? (zeitpunkt.getTime() - t0) / (t1 - t0) : 0;
      const wert = vor.energyWh + frac * (nach.energyWh - vor.energyWh);
      return { wert, geschaetzt: true };
    }
    return { wert: vor.energyWh, geschaetzt: false };
  }

  if (vor) return { wert: vor.energyWh, geschaetzt: false };
  if (nach) return { wert: nach.energyWh, geschaetzt: true };
  return null;
}

interface Grenzwerte {
  start: number;
  ende: number;
  geschaetzt: boolean;
}

async function zaehlerstandGrenzwerte(geraetId: string, phase: string, zeitraum: Zeitraum): Promise<Grenzwerte | null> {
  const [start, ende] = await Promise.all([
    zaehlerstandZumZeitpunkt(geraetId, phase, zeitraum.von),
    zaehlerstandZumZeitpunkt(geraetId, phase, zeitraum.bis),
  ]);
  if (!start || !ende) return null;
  return { start: start.wert, ende: ende.wert, geschaetzt: start.geschaetzt || ende.geschaetzt };
}

/**
 * Verbrauch (Wh) einer einzelnen Geraet/Phase-Kombination im Zeitraum, als
 * Differenz zweier kumulativer Zaehlerstaende. Ein negativer Delta (z.B.
 * durch Zaehler-Reset bei Geraetetausch) wird auf 0 abgefangen.
 */
export async function phasenVerbrauchWh(geraetId: string, phase: string, zeitraum: Zeitraum): Promise<number> {
  const grenzwerte = await zaehlerstandGrenzwerte(geraetId, phase, zeitraum);
  if (!grenzwerte) return 0;
  return Math.max(0, grenzwerte.ende - grenzwerte.start);
}

async function allePhasenDesGeraets(shellyGeraetId: string): Promise<string[]> {
  const vorhanden = await prisma.messwert.findMany({
    where: { geraetId: shellyGeraetId },
    distinct: ["phase"],
    select: { phase: true },
  });
  return vorhanden.map((p) => p.phase);
}

/**
 * Gesamtverbrauch (kWh) einer Einheit im Zeitraum: summiert ueber alle ihr
 * zugeordneten Geraete (ADDIEREN) abzueglich aller als SUBTRAHIEREN
 * zugeordneten Geraete. Ergebnis bei 0 abgeschnitten.
 */
export async function verbrauchKwhFuerEinheit(einheitId: string, zeitraum: Zeitraum): Promise<number> {
  const zuordnungen = await prisma.geraetZuordnung.findMany({ where: { einheitId } });

  let totalWh = 0;
  for (const zuordnung of zuordnungen) {
    const phasen = await allePhasenDesGeraets(zuordnung.shellyGeraetId);
    let geraetWh = 0;
    for (const phase of phasen) {
      geraetWh += await phasenVerbrauchWh(zuordnung.shellyGeraetId, phase, zeitraum);
    }
    totalWh += zuordnung.modus === "SUBTRAHIEREN" ? -geraetWh : geraetWh;
  }

  return Math.max(0, totalWh) / 1000;
}

export interface Zaehlerstaende {
  anfangKwh: number;
  endeKwh: number;
  // true, wenn mindestens ein Grenz-Zaehlerstand geschaetzt (interpoliert) wurde.
  geschaetzt: boolean;
}

/**
 * Aggregierter Anfangs- und Endzählerstand (kWh) einer Einheit für den
 * Zeitraum (Pflichtausweis auf der Rechnung), inkl. Schaetz-Flag. Bei mehreren
 * zugeordneten Geraeten werden die Rohzaehlerstaende mit demselben Vorzeichen
 * wie in der Verbrauchsberechnung aufsummiert.
 */
export async function zaehlerstaendeFuerEinheit(einheitId: string, zeitraum: Zeitraum): Promise<Zaehlerstaende> {
  const zuordnungen = await prisma.geraetZuordnung.findMany({ where: { einheitId } });

  let anfangWh = 0;
  let endeWh = 0;
  let geschaetzt = false;
  for (const zuordnung of zuordnungen) {
    const vorzeichen = zuordnung.modus === "SUBTRAHIEREN" ? -1 : 1;
    const phasen = await allePhasenDesGeraets(zuordnung.shellyGeraetId);
    for (const phase of phasen) {
      const grenzwerte = await zaehlerstandGrenzwerte(zuordnung.shellyGeraetId, phase, zeitraum);
      if (!grenzwerte) continue;
      anfangWh += vorzeichen * grenzwerte.start;
      endeWh += vorzeichen * grenzwerte.ende;
      if (grenzwerte.geschaetzt) geschaetzt = true;
    }
  }

  return { anfangKwh: anfangWh / 1000, endeKwh: endeWh / 1000, geschaetzt };
}
