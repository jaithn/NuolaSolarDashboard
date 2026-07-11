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
  // Defense in Depth: pdfPfad stammt zwar ausschliesslich aus serverseitig
  // erzeugten Rechnungsnummern, trotzdem strikt auf einen einfachen
  // PDF-Dateinamen ohne Pfadbestandteile beschraenken (kein Path Traversal,
  // selbst wenn der DB-Wert manipuliert wuerde).
  if (filename !== path.basename(filename) || !/^[A-Za-z0-9._-]+\.pdf$/.test(filename)) {
    throw new Error(`Unzulässiger PDF-Dateiname: ${filename}`);
  }
  return path.join(PDF_STORAGE_DIR, filename);
}

/** Rendert das Rechnungs-PDF, speichert es und aktualisiert den pdfPfad der Rechnung. */
export async function generateAndStoreInvoicePdf(rechnungId: string): Promise<string> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({
    where: { id: rechnungId },
    include: {
      positionen: { include: { steuersatz: true }, orderBy: { sortierung: "asc" } },
      mietpartei: { include: { einheit: { include: { objekt: true } } } },
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

  // Logo: entweder das im Admin hochgeladene, sonst das mitgelieferte offizielle
  // Nuola Solar Logo (public/nuola-solar-logo.png, im Docker-Image enthalten).
  const logoAbsolutePath = designvorlage.logoPfad
    ? path.join(process.cwd(), "public", designvorlage.logoPfad)
    : path.join(process.cwd(), "public", "nuola-solar-logo.png");

  // Alte Default-Farben (Teal/„Grün“) auf die Nuola-Solar-Style-Guide-Farben
  // umsetzen, ohne bewusst gesetzte Admin-Farben zu ueberschreiben.
  const primaerfarbe = designvorlage.primaerfarbe === "#0f766e" ? "#d9a441" : designvorlage.primaerfarbe;
  const sekundaerfarbe = designvorlage.sekundaerfarbe === "#0f172a" ? "#1c1c21" : designvorlage.sekundaerfarbe;

  // Empfaengeranschrift = Objektadresse (die Mietpartei wohnt im Objekt).
  // Strasse und PLZ/Ort getrennt, damit sie auf zwei Zeilen dargestellt werden.
  const objekt = rechnung.mietpartei.einheit.objekt;
  const empfaengerStrasse = objekt.adresse || null;
  const empfaengerPlzOrt = `${objekt.plz} ${objekt.ort}`.trim() || null;

  const buffer = await renderToBuffer(
    <InvoiceDocument
      firma={firma}
      designvorlage={{ ...designvorlage, logoPfad: logoAbsolutePath, primaerfarbe, sekundaerfarbe }}
      mietpartei={{ name: rechnung.mietpartei.name, anschrift: empfaengerStrasse, plzOrt: empfaengerPlzOrt }}
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
