import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { mietparteiAnzeigeName, anredeSatz, empfaengerAnredeKurz, mietparteiPostanschrift } from "@/lib/mietpartei";
import { InvoiceDocument } from "./invoiceDocument";
import type { FirmaBriefData } from "./letterLayout";

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

  // Empfaengeranschrift = Objektadresse (die Mietpartei wohnt im Objekt).
  // Strasse und PLZ/Ort getrennt, damit sie auf zwei Zeilen dargestellt werden.
  const objekt = rechnung.mietpartei.einheit.objekt;
  const mp = rechnung.mietpartei;
  const displayName = mietparteiAnzeigeName(mp);
  const anrede = anredeSatz(mp);

  const firmaBrief: FirmaBriefData = {
    name: firma.name,
    anschrift: firma.anschrift,
    plz: firma.plz,
    ort: firma.ort,
    steuernummer: firma.steuernummer,
    ustIdNr: firma.ustIdNr,
    bankname: firma.bankname,
    bankverbindung: firma.bankverbindung,
    kontaktTelefon: firma.kontaktTelefon,
    kontaktEmail: firma.kontaktEmail,
    webseite: firma.webseite,
  };

  const buffer = await renderToBuffer(
    <InvoiceDocument
      firma={firmaBrief}
      logoPfad={logoAbsolutePath}
      empfaenger={{
        anredeKurz: empfaengerAnredeKurz(mp),
        name: displayName,
        ...mietparteiPostanschrift(mp, objekt),
      }}
      bearbeiterName={objekt.bearbeiterName}
      kundennummer={mp.kundennummer}
      anredeSatz={anrede}
      // Entwuerfe haben noch keine offizielle Nummer (wird erst bei Freigabe
      // vergeben) - im PDF-Entwurf entsprechend als "ENTWURF" kennzeichnen.
      rechnung={{ ...rechnung, rechnungsnummer: rechnung.rechnungsnummer ?? "ENTWURF" }}
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
  // Dateiname bewusst ueber die (stabile) Rechnungs-ID statt der Nummer:
  // Entwuerfe haben noch keine Nummer, und die ID bleibt auch nach Vergabe der
  // Nummer bei Freigabe unveraendert (kein Umbenennen der Datei noetig).
  const filename = `${rechnung.id}.pdf`;
  await writeFile(resolvePdfFilePath(filename), buffer);

  await prisma.rechnung.update({ where: { id: rechnungId }, data: { pdfPfad: filename } });
  return filename;
}
