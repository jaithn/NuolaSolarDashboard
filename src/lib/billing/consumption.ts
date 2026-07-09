import { prisma } from "@/lib/db";

export interface Zeitraum {
  von: Date;
  bis: Date;
}

/**
 * Ermittelt Anfangs- und Endzählerstand (Wh) einer Geraet/Phase-Kombination im
 * Zeitraum. Fehlt ein Messwert am oder vor "von" (z.B. Geraet erst waehrend
 * des Zeitraums installiert), wird der frueheste im Zeitraum verfuegbare Wert
 * als Startbasis verwendet - fehlende Messwerte vor Installation koennen
 * naturgemaess nicht rekonstruiert werden.
 */
async function zaehlerstandGrenzwerte(
  geraetId: string,
  phase: string,
  zeitraum: Zeitraum,
): Promise<{ start: number; ende: number } | null> {
  const endReading = await prisma.messwert.findFirst({
    where: { geraetId, phase, timestamp: { lte: zeitraum.bis } },
    orderBy: { timestamp: "desc" },
  });
  if (!endReading) return null;

  const startReading =
    (await prisma.messwert.findFirst({
      where: { geraetId, phase, timestamp: { lte: zeitraum.von } },
      orderBy: { timestamp: "desc" },
    })) ??
    (await prisma.messwert.findFirst({
      where: { geraetId, phase, timestamp: { gte: zeitraum.von, lte: zeitraum.bis } },
      orderBy: { timestamp: "asc" },
    }));
  if (!startReading) return null;

  return { start: startReading.energyWh, ende: endReading.energyWh };
}

/**
 * Verbrauch (Wh) einer einzelnen Geraet/Phase-Kombination im Zeitraum, als
 * Differenz zweier kumulativer Zaehlerstaende. Ein negativer Delta (z.B.
 * durch Zaehler-Reset bei Geraetetausch) wird auf 0 abgefangen statt eine
 * negative Verbrauchsmenge auszuweisen.
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
 * zugeordneten Geraete (z.B. ein Allgemeinstrom-Zwischenzaehler im Stromkreis
 * eines Mieters). Ein Geraet kann dabei mehreren Einheiten zugeordnet sein
 * (z.B. derselbe Allgemeinstrom-Zaehler bei mehreren Mietparteien). Das
 * Ergebnis wird bei 0 abgeschnitten, falls die Subtraktion rechnerisch
 * negativ wuerde (z.B. durch Messungenauigkeiten).
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
}

/**
 * Aggregierter Anfangs- und Endzählerstand (kWh) einer Einheit für den
 * Zeitraum - fuer den Pflichtausweis "Anfangs- und Endzählerstand" auf der
 * Rechnung. Bei mehreren zugeordneten Geraeten (z.B. mehrere Shellys pro
 * Einheit oder ein per SUBTRAHIEREN abgezogener Allgemeinstrom-Zwischen-
 * zaehler) werden die jeweiligen Rohzaehlerstaende mit demselben Vorzeichen
 * wie in der Verbrauchsberechnung aufsummiert, sodass "Endstand - Anfangs-
 * stand" rechnerisch dem ausgewiesenen Verbrauch entspricht (Ausnahme: ein
 * Zaehler-Reset/Geraetetausch waehrend des Zeitraums, siehe
 * phasenVerbrauchWh - in diesem seltenen Fall ist "eine durchgehende
 * Zaehlerablesung" ohnehin kein sinnvoller Begriff mehr).
 */
export async function zaehlerstaendeFuerEinheit(einheitId: string, zeitraum: Zeitraum): Promise<Zaehlerstaende> {
  const zuordnungen = await prisma.geraetZuordnung.findMany({ where: { einheitId } });

  let anfangWh = 0;
  let endeWh = 0;
  for (const zuordnung of zuordnungen) {
    const vorzeichen = zuordnung.modus === "SUBTRAHIEREN" ? -1 : 1;
    const phasen = await allePhasenDesGeraets(zuordnung.shellyGeraetId);
    for (const phase of phasen) {
      const grenzwerte = await zaehlerstandGrenzwerte(zuordnung.shellyGeraetId, phase, zeitraum);
      if (!grenzwerte) continue;
      anfangWh += vorzeichen * grenzwerte.start;
      endeWh += vorzeichen * grenzwerte.ende;
    }
  }

  return { anfangKwh: anfangWh / 1000, endeKwh: endeWh / 1000 };
}
