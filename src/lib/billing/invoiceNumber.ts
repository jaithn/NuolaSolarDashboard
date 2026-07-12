import { prisma } from "@/lib/db";

/**
 * Vergibt fortlaufend und lückenlos die nächste Rechnungsnummer eines Jahres
 * (Format NUOLA-{Jahr}-{Nummer:04d}). Increment und Lesen erfolgen innerhalb
 * einer einzigen Prisma-Transaktion; da SQLite Schreibzugriffe ohnehin
 * serialisiert, ist damit ausgeschlossen, dass zwei parallele Aufrufe
 * dieselbe Nummer erhalten.
 */
export async function vergibNaechsteRechnungsnummer(jahr: number): Promise<string> {
  const zaehler = await prisma.$transaction(async (tx) => {
    await tx.rechnungsnummernZaehler.upsert({
      where: { jahr },
      update: { letzteNummer: { increment: 1 } },
      create: { jahr, letzteNummer: 1 },
    });
    return tx.rechnungsnummernZaehler.findUniqueOrThrow({ where: { jahr } });
  });

  return `NUOLA-${jahr}-${String(zaehler.letzteNummer).padStart(4, "0")}`;
}

/**
 * Wie vergibNaechsteRechnungsnummer, aber fuer die separate, ebenfalls
 * lueckenlose Nummernfolge ausserhalb des Systems geschriebener Rechnungen
 * (Praefix NUOLA-EXT-{Jahr}-{Nummer:04d}). Bewusst eigener Zaehler, damit die
 * beiden Folgen sich nicht vermischen.
 */
export async function vergibNaechsteExterneRechnungsnummer(jahr: number): Promise<string> {
  const zaehler = await prisma.$transaction(async (tx) => {
    await tx.externeRechnungsnummernZaehler.upsert({
      where: { jahr },
      update: { letzteNummer: { increment: 1 } },
      create: { jahr, letzteNummer: 1 },
    });
    return tx.externeRechnungsnummernZaehler.findUniqueOrThrow({ where: { jahr } });
  });

  return `NUOLA-EXT-${jahr}-${String(zaehler.letzteNummer).padStart(4, "0")}`;
}
