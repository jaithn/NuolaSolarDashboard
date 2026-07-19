import { prisma } from "@/lib/db";
import { verbrauchKwhGeteilt, zaehlerstaendeFuerEinheit } from "./consumption";
import { splitteNachSteuersatz, tageZwischen, type RechnungspositionEntwurf, type Zeitraum } from "./taxSplit";
import { berechneBrutto } from "@/lib/steuer";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";

/**
 * Fehler, der signalisiert, dass fuer dieselbe Einheit bereits eine Rechnung
 * mit ueberschneidendem Zeitraum existiert. Die Server-Action faengt ihn ab
 * und leitet den Nutzer durch den Storno-/Korrektur-Workflow.
 */
export class UeberschneidendeRechnungError extends Error {
  constructor(
    public readonly existierendeRechnungId: string,
    public readonly istEntwurf: boolean,
    public readonly rechnungsnummer: string | null,
  ) {
    super(
      istEntwurf
        ? "Für diese Einheit existiert bereits ein Entwurf mit überschneidendem Zeitraum."
        : "Für diese Einheit existiert bereits eine freigegebene Rechnung mit überschneidendem Zeitraum.",
    );
    this.name = "UeberschneidendeRechnungError";
  }
}

/**
 * Prueft, ob fuer die Einheit der Mietpartei bereits eine (nicht stornierte)
 * Rechnung mit ueberschneidendem Abrechnungszeitraum existiert. Wirft
 * UeberschneidendeRechnungError, wenn ja. Storno-Rechnungen und bereits
 * stornierte Rechnungen werden ignoriert. Ueber alle Mietparteien derselben
 * Einheit hinweg (Mieterwechsel), da sich Zeitraeume sonst ueberlappen koennten.
 */
export async function pruefeKeineUeberschneidung(
  einheitId: string,
  zeitraum: Zeitraum,
  ignoriereRechnungId?: string,
): Promise<void> {
  const stornierteIds = (
    await prisma.rechnung.findMany({ where: { stornoVonId: { not: null } }, select: { stornoVonId: true } })
  )
    .map((r) => r.stornoVonId)
    .filter((id): id is string => id !== null);

  const konflikt = await prisma.rechnung.findFirst({
    where: {
      mietpartei: { einheitId },
      status: { not: "STORNIERT" },
      stornoVonId: null, // Stornorechnungen selbst nicht als Konflikt werten
      id: { notIn: [...stornierteIds, ...(ignoriereRechnungId ? [ignoriereRechnungId] : [])] },
      zeitraumVon: { lte: zeitraum.bis },
      zeitraumBis: { gte: zeitraum.von },
    },
    orderBy: { erstelltAm: "desc" },
  });

  if (konflikt) {
    throw new UeberschneidendeRechnungError(konflikt.id, konflikt.status === "ENTWURF", konflikt.rechnungsnummer);
  }
}

// Durchschnittliche Kalendertage pro Monat - Grundlage fuer die taggenaue
// anteilige Umrechnung der geleisteten Abschlaege auf ihren Ueberschneidungs-
// zeitraum mit der Abrechnung. (Die Grundgebuehr wird dagegen nach ganzen
// Monaten berechnet, siehe anzahlMonate.)
const TAGE_PRO_MONAT = 365.25 / 12;

export interface GenerateInvoiceParams {
  mietparteiId: string;
  typ: "JAHRESABRECHNUNG" | "SCHLUSSRECHNUNG";
  von: Date;
  bis: Date;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}
function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

// Anzahl der (Kalender-)Monate, die ein Zeitraum beruehrt - inklusive Start-
// und Endmonat. 1.1.-31.12. ergibt 12, nicht 11,99. Grundlage fuer die
// Grundgebuehr, die pro Monat vereinbart ist und nicht taggenau, sondern nach
// tatsaechlichen Monaten berechnet werden soll.
function anzahlMonate(von: Date, bis: Date): number {
  const monate = (bis.getUTCFullYear() - von.getUTCFullYear()) * 12 + (bis.getUTCMonth() - von.getUTCMonth()) + 1;
  return Math.max(1, monate);
}

export async function erstelleRechnungsentwurf(
  params: GenerateInvoiceParams & { ueberschneidungErlauben?: boolean },
): Promise<{ rechnungId: string }> {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({ where: { id: params.mietparteiId } });
  const steuersaetze = await prisma.steuersatz.findMany();
  const zeitraum: Zeitraum = { von: params.von, bis: params.bis };

  // Duplikat-/Ueberschneidungs-Sperre (rechtlich: pro Einheit und Zeitraum nur
  // eine gueltige Rechnung). Kann fuer den bewussten Korrektur-Fall nach Storno
  // per Flag uebersprungen werden.
  if (!params.ueberschneidungErlauben) {
    await pruefeKeineUeberschneidung(mietpartei.einheitId, zeitraum);
  }

  const { gesamtKwh: verbrauchKwh, allgemeinKwh, waermepumpeKwh, hatWaermepumpe } = await verbrauchKwhGeteilt(
    mietpartei.einheitId,
    zeitraum,
  );
  const { anfangKwh, endeKwh, geschaetzt: verbrauchGeschaetzt } = await zaehlerstaendeFuerEinheit(
    mietpartei.einheitId,
    zeitraum,
  );
  const ap = mietpartei.arbeitspreisNetto;
  const arbeitsNetto = (kwh: number) => Math.round(kwh * ap * 100) / 100;

  // Bei Waermepumpen-Zaehlern wird der Arbeitspreis-Anteil getrennt ausgewiesen:
  // Allgemeinstrom (Grundpreis + Arbeitspreis, unten) und Waermepumpe (NUR
  // Arbeitspreis) - beide in EINER Rechnung. Ohne Waermepumpe eine einzige
  // Stromverbrauchs-Position wie bisher.
  const positionenEntwurf: RechnungspositionEntwurf[] = hatWaermepumpe
    ? [
        ...splitteNachSteuersatz(
          `Stromverbrauch Allgemeinstrom (${allgemeinKwh.toFixed(2)} kWh × ${ap.toFixed(4)} €/kWh Arbeitspreis)`,
          arbeitsNetto(allgemeinKwh),
          zeitraum,
          steuersaetze,
        ),
        ...splitteNachSteuersatz(
          `Stromverbrauch Wärmepumpe (${waermepumpeKwh.toFixed(2)} kWh × ${ap.toFixed(4)} €/kWh Arbeitspreis)`,
          arbeitsNetto(waermepumpeKwh),
          zeitraum,
          steuersaetze,
        ),
      ]
    : [
        ...splitteNachSteuersatz(
          `Stromverbrauch (${verbrauchKwh.toFixed(2)} kWh × ${ap.toFixed(4)} €/kWh Arbeitspreis)`,
          arbeitsNetto(verbrauchKwh),
          zeitraum,
          steuersaetze,
        ),
      ];

  if (mietpartei.grundpreisNetto) {
    const monate = anzahlMonate(zeitraum.von, zeitraum.bis);
    const grundpreisGesamtNetto = Math.round(mietpartei.grundpreisNetto * monate * 100) / 100;
    positionenEntwurf.push(
      ...splitteNachSteuersatz(
        `Grundgebühr (${mietpartei.grundpreisNetto.toFixed(2)} €/Monat × ${monate} Monate)`,
        grundpreisGesamtNetto,
        zeitraum,
        steuersaetze,
      ),
    );
  }

  // Abschlaege: Summe der im Zeitraum faelligen, bereits geleisteten
  // Abschlaege. Bewusst OHNE Neuaufteilung nach dem zum Rechnungsdatum
  // gueltigen Steuersatz - ein Abschlag wurde jeweils mit dem zum Zeitpunkt
  // seiner Faelligkeit gueltigen (am Abschlag-Datensatz hinterlegten) Satz
  // eingezogen, das bildet die tatsaechlich geleisteten Zahlungen korrekt ab.
  const abschlaege = await prisma.abschlag.findMany({
    where: { mietparteiId: params.mietparteiId },
    include: { steuersatz: true },
  });

  let summeAbschlaegeBrutto = 0;
  for (const abschlag of abschlaege) {
    const abschlagBis = abschlag.gueltigBis ?? zeitraum.bis;
    if (abschlag.gueltigAb > zeitraum.bis || abschlagBis < zeitraum.von) continue;

    const overlapVon = maxDate(abschlag.gueltigAb, zeitraum.von);
    const overlapBis = minDate(abschlagBis, zeitraum.bis);
    const monateAnteil = tageZwischen(overlapVon, overlapBis) / TAGE_PRO_MONAT;
    // Der Abschlag wird brutto (inkl. MwSt.) erfasst und genau so eingezogen -
    // dieser Brutto-Wert ist massgeblich. Fallback fuer Alt-Datensaetze: aus dem
    // Netto berechnen.
    const bruttoProMonat =
      abschlag.bruttoBetrag ?? berechneBrutto(abschlag.nettoBetrag, abschlag.steuersatz.prozentsatz).bruttoBetrag;
    summeAbschlaegeBrutto += bruttoProMonat * monateAnteil;
  }
  summeAbschlaegeBrutto = Math.round(summeAbschlaegeBrutto * 100) / 100;

  const verbrauchskostenBrutto = Math.round(positionenEntwurf.reduce((sum, p) => sum + p.bruttoBetrag, 0) * 100) / 100;
  const verrechnungBetrag = Math.round((verbrauchskostenBrutto - summeAbschlaegeBrutto) * 100) / 100;

  // Bewusst KEINE Rechnungsnummer im Entwurf: die lueckenlose Nummer wird erst
  // bei Freigabe/Versand vergeben (siehe releaseInvoice.ts), damit geloeschte
  // Entwuerfe keine Luecke in der Nummernfolge hinterlassen.
  const rechnung = await prisma.rechnung.create({
    data: {
      mietparteiId: params.mietparteiId,
      typ: params.typ,
      rechnungsnummer: null,
      zeitraumVon: params.von,
      zeitraumBis: params.bis,
      status: "ENTWURF",
      ausstellungsdatum: new Date(),
      anfangszaehlerstandKwh: Math.round(anfangKwh * 100) / 100,
      endzaehlerstandKwh: Math.round(endeKwh * 100) / 100,
      gesamtVerbrauchKwh: Math.round(verbrauchKwh * 100) / 100,
      verbrauchGeschaetzt,
      arbeitspreisNetto: mietpartei.arbeitspreisNetto,
      grundgebuehrMonatlichNetto: mietpartei.grundpreisNetto,
      summeAbschlaegeBrutto,
      verbrauchskostenBrutto,
      verrechnungBetrag,
      positionen: {
        create: positionenEntwurf.map((p, i) => ({ ...p, sortierung: i })),
      },
    },
  });

  return { rechnungId: rechnung.id };
}

export interface BatchErgebnis {
  erstellt: { mietparteiId: string; rechnungId: string; bezeichner: string }[];
  uebersprungen: { mietparteiId: string; bezeichner: string; grund: string }[];
}

/**
 * Erstellt in einem Schwung Rechnungsentwuerfe fuer alle im Zeitraum aktiven
 * Mietparteien. Mietparteien mit bereits existierender, ueberschneidender
 * Rechnung werden uebersprungen (und im Ergebnis ausgewiesen), statt den
 * ganzen Vorgang abzubrechen.
 */
export async function erstelleEntwuerfeFuerAktiveEinheiten(params: {
  von: Date;
  bis: Date;
  typ: "JAHRESABRECHNUNG" | "SCHLUSSRECHNUNG";
}): Promise<BatchErgebnis> {
  // Im Zeitraum aktive Mietverhaeltnisse: Status AKTIV und Ein-/Auszug
  // ueberschneiden den Abrechnungszeitraum.
  const mietparteien = await prisma.mietpartei.findMany({
    where: {
      status: "AKTIV",
      einzugsdatum: { lte: params.bis },
      OR: [{ auszugsdatum: null }, { auszugsdatum: { gte: params.von } }],
    },
    include: { einheit: { include: { objekt: true } } },
    orderBy: { einheitId: "asc" },
  });

  const ergebnis: BatchErgebnis = { erstellt: [], uebersprungen: [] };
  for (const m of mietparteien) {
    const bezeichner = `${m.firma?.trim() || m.name || "Mietpartei"} (${m.einheit.objekt.name} – ${m.einheit.bezeichnung})`;
    try {
      const { rechnungId } = await erstelleRechnungsentwurf({
        mietparteiId: m.id,
        typ: params.typ,
        von: params.von,
        bis: params.bis,
      });
      await generateAndStoreInvoicePdf(rechnungId);
      ergebnis.erstellt.push({ mietparteiId: m.id, rechnungId, bezeichner });
    } catch (err) {
      const grund =
        err instanceof UeberschneidendeRechnungError
          ? "Es existiert bereits eine Rechnung mit überschneidendem Zeitraum."
          : err instanceof Error
            ? err.message
            : "Unbekannter Fehler.";
      ergebnis.uebersprungen.push({ mietparteiId: m.id, bezeichner, grund });
    }
  }
  return ergebnis;
}
