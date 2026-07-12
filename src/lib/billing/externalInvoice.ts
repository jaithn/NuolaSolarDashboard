import { prisma } from "@/lib/db";
import { vergibNaechsteExterneRechnungsnummer } from "./invoiceNumber";

/**
 * Erfasst eine ausserhalb des Systems geschriebene Rechnung: vergibt aus der
 * separaten, lueckenlosen Folge (Praefix NUOLA-EXT-...) die naechste Nummer und
 * dokumentiert Minimal-Metadaten, damit die externe Nummernfolge nachvollzieh-
 * bar bleibt. Gibt die vergebene Nummer zurueck - diese traegt der Nutzer dann
 * auf der ausserhalb erstellten Rechnung ein.
 */
export async function erfasseExterneRechnung(params: {
  empfaenger: string;
  betreff?: string | null;
  betragBrutto?: number | null;
  ausstellungsdatum: Date;
  notiz?: string | null;
}): Promise<{ rechnungsnummer: string }> {
  const rechnungsnummer = await vergibNaechsteExterneRechnungsnummer(params.ausstellungsdatum.getUTCFullYear());
  await prisma.externeRechnung.create({
    data: {
      rechnungsnummer,
      empfaenger: params.empfaenger,
      betreff: params.betreff?.trim() || null,
      betragBrutto: params.betragBrutto ?? null,
      ausstellungsdatum: params.ausstellungsdatum,
      notiz: params.notiz?.trim() || null,
    },
  });
  return { rechnungsnummer };
}
