import { prisma } from "@/lib/db";

// Erste vergebene Kundennummer ist BASIS + 1 (also 10001). Fuenfstellig, klar
// als Kundennummer erkennbar.
const BASIS = 10000;

/**
 * Vergibt fortlaufend die naechste Kundennummer an eine Mietpartei, falls diese
 * noch keine hat. Idempotent: ist bereits eine gesetzt, wird sie unveraendert
 * zurueckgegeben. Die Vergabe (max+1) laeuft in einer Transaktion; SQLite
 * serialisiert Schreibzugriffe, sodass keine Doppelvergabe entsteht.
 */
export async function vergibKundennummerFallsNoetig(mietparteiId: string): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const mp = await tx.mietpartei.findUnique({
      where: { id: mietparteiId },
      select: { kundennummer: true },
    });
    if (!mp) return null;
    if (mp.kundennummer != null) return mp.kundennummer;

    const max = await tx.mietpartei.aggregate({ _max: { kundennummer: true } });
    const naechste = (max._max.kundennummer ?? BASIS) + 1;
    await tx.mietpartei.update({ where: { id: mietparteiId }, data: { kundennummer: naechste } });
    return naechste;
  });
}
