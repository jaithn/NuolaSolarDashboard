import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolvePdfFilePath } from "@/lib/pdf/renderInvoicePdf";

/**
 * Loescht einen Rechnungsentwurf vollstaendig. Nur im Status ENTWURF erlaubt -
 * Entwuerfe haben noch keine offizielle Nummer, daher entsteht durch das
 * Loeschen KEINE Luecke in der Nummernfolge (siehe Nummernvergabe erst bei
 * Freigabe). Positionen werden per Cascade mitgeloescht; ein evtl. erzeugtes
 * Entwurfs-PDF wird best-effort entfernt.
 */
export async function loescheRechnungsentwurf(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({ where: { id: rechnungId } });
  if (rechnung.status !== "ENTWURF") {
    throw new Error("Nur Entwürfe können gelöscht werden. Freigegebene Rechnungen bitte stornieren.");
  }

  if (rechnung.pdfPfad) {
    try {
      await unlink(resolvePdfFilePath(rechnung.pdfPfad));
    } catch {
      // PDF evtl. nicht (mehr) vorhanden - Loeschen der Rechnung trotzdem fortsetzen.
    }
  }
  await prisma.rechnung.delete({ where: { id: rechnungId } });
}
