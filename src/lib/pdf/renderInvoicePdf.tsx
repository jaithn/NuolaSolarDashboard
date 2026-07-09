import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { InvoiceDocument } from "./invoiceDocument";

// Bewusst NICHT unter public/ - Rechnungs-PDFs duerfen nur dem jeweiligen
// Mieter bzw. dem Admin zugaenglich sein (siehe /api/rechnungen/[id]/pdf),
// nicht oeffentlich unter einer statischen URL. Liegt im selben Volume wie
// die SQLite-Datenbank, bleibt also ueber Neustarts hinweg erhalten.
const PDF_STORAGE_DIR = path.join(process.cwd(), "data", "rechnungen");

export function resolvePdfFilePath(filename: string): string {
  return path.join(PDF_STORAGE_DIR, filename);
}

/** Rendert das Rechnungs-PDF, speichert es und aktualisiert den pdfPfad der Rechnung. */
export async function generateAndStoreInvoicePdf(rechnungId: string): Promise<string> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({
    where: { id: rechnungId },
    include: {
      positionen: { include: { steuersatz: true }, orderBy: { sortierung: "asc" } },
      mietpartei: true,
    },
  });

  const [firma, designvorlage] = await Promise.all([
    prisma.firmenStammdaten.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", name: "Nuola Solar GbR", anschrift: "" },
    }),
    prisma.rechnungsDesignvorlage.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  const logoAbsolutePath = designvorlage.logoPfad
    ? path.join(process.cwd(), "public", designvorlage.logoPfad)
    : null;

  const buffer = await renderToBuffer(
    <InvoiceDocument
      firma={firma}
      designvorlage={{ ...designvorlage, logoPfad: logoAbsolutePath }}
      mietpartei={{ name: rechnung.mietpartei.name, anschrift: rechnung.mietpartei.anschrift }}
      rechnung={rechnung}
      positionen={rechnung.positionen.map((p) => ({
        bezeichnung: p.bezeichnung,
        nettoBetrag: p.nettoBetrag,
        steuersatzProzent: p.steuersatz.prozentsatz,
        steuerBetrag: p.steuerBetrag,
        bruttoBetrag: p.bruttoBetrag,
      }))}
    />,
  );

  await mkdir(PDF_STORAGE_DIR, { recursive: true });
  const filename = `${rechnung.rechnungsnummer}.pdf`;
  await writeFile(resolvePdfFilePath(filename), buffer);

  await prisma.rechnung.update({ where: { id: rechnungId }, data: { pdfPfad: filename } });
  return filename;
}
