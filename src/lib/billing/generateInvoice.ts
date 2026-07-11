import { prisma } from "@/lib/db";
import { verbrauchKwhFuerEinheit, zaehlerstaendeFuerEinheit } from "./consumption";
import { splitteNachSteuersatz, tageZwischen, type RechnungspositionEntwurf, type Zeitraum } from "./taxSplit";
import { berechneBrutto } from "@/lib/steuer";
import { vergibNaechsteRechnungsnummer } from "./invoiceNumber";

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

export async function erstelleRechnungsentwurf(params: GenerateInvoiceParams): Promise<{ rechnungId: string }> {
  const mietpartei = await prisma.mietpartei.findUniqueOrThrow({ where: { id: params.mietparteiId } });
  const steuersaetze = await prisma.steuersatz.findMany();
  const zeitraum: Zeitraum = { von: params.von, bis: params.bis };

  const verbrauchKwh = await verbrauchKwhFuerEinheit(mietpartei.einheitId, zeitraum);
  const { anfangKwh, endeKwh, geschaetzt: verbrauchGeschaetzt } = await zaehlerstaendeFuerEinheit(
    mietpartei.einheitId,
    zeitraum,
  );
  const arbeitspreisGesamtNetto = Math.round(verbrauchKwh * mietpartei.arbeitspreisNetto * 100) / 100;

  const positionenEntwurf: RechnungspositionEntwurf[] = [
    ...splitteNachSteuersatz(
      `Stromverbrauch (Zählerstand ${anfangKwh.toFixed(2)} → ${endeKwh.toFixed(2)} kWh = ${verbrauchKwh.toFixed(2)} kWh × ${mietpartei.arbeitspreisNetto.toFixed(4)} €/kWh Arbeitspreis)`,
      arbeitspreisGesamtNetto,
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
    const nettoAnteil = abschlag.nettoBetrag * monateAnteil;
    const { bruttoBetrag } = berechneBrutto(nettoAnteil, abschlag.steuersatz.prozentsatz);
    summeAbschlaegeBrutto += bruttoBetrag;
  }
  summeAbschlaegeBrutto = Math.round(summeAbschlaegeBrutto * 100) / 100;

  const verbrauchskostenBrutto = Math.round(positionenEntwurf.reduce((sum, p) => sum + p.bruttoBetrag, 0) * 100) / 100;
  const verrechnungBetrag = Math.round((verbrauchskostenBrutto - summeAbschlaegeBrutto) * 100) / 100;

  const rechnungsnummer = await vergibNaechsteRechnungsnummer(params.bis.getUTCFullYear());

  const rechnung = await prisma.rechnung.create({
    data: {
      mietparteiId: params.mietparteiId,
      typ: params.typ,
      rechnungsnummer,
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
