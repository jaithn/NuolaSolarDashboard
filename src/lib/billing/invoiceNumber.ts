import { prisma } from "@/lib/db";

/**
 * Vergibt fortlaufend und lückenlos die nächste Rechnungsnummer eines Jahres
 * (Format NuolaSolar-{Jahr}-S{Nummer:04d}). Increment und Lesen erfolgen
 * innerhalb einer einzigen Prisma-Transaktion; da SQLite Schreibzugriffe ohnehin
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

  return `NuolaSolar-${jahr}-S${String(zaehler.letzteNummer).padStart(4, "0")}`;
}
