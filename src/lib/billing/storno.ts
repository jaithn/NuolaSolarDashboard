import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { vergibNaechsteRechnungsnummer } from "./invoiceNumber";
import { generateAndStoreInvoicePdf, resolvePdfFilePath } from "@/lib/pdf/renderInvoicePdf";
import { sendMail } from "@/lib/mail/mailer";
import { invoiceSentEmailHtml } from "@/lib/mail/templates";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

/**
 * Erzeugt zu einer bereits freigegebenen/versendeten Rechnung eine
 * Stornorechnung (Rechnungskorrektur i.S.d. § 14 UStG): ein eigenstaendiges
 * Rechnungsdokument mit EIGENER, neuer lueckenloser Nummer, das auf das
 * Original verweist (stornoVonId) und dessen Betraege negiert. Das Original
 * bleibt unveraendert erhalten, wird aber als STORNIERT markiert. Rechnungs-
 * nummern werden nie wiederverwendet.
 *
 * Danach kann fuer denselben Zeitraum eine neue (korrigierte) Rechnung erstellt
 * werden - die Duplikat-Sperre ignoriert stornierte Originale und Storno-
 * rechnungen, sodass der normale Entwurfs-Weg wieder frei ist.
 */
export async function storniereRechnung(originalId: string): Promise<{ stornoRechnungId: string }> {
  const original = await prisma.rechnung.findUniqueOrThrow({
    where: { id: originalId },
    include: { positionen: true, mietpartei: true },
  });

  if (original.status === "ENTWURF") {
    throw new Error("Entwürfe werden nicht storniert, sondern gelöscht.");
  }
  if (original.status === "STORNIERT") {
    throw new Error("Diese Rechnung ist bereits storniert.");
  }
  if (original.stornoVonId) {
    throw new Error("Eine Stornorechnung kann nicht storniert werden.");
  }
  if (!original.rechnungsnummer) {
    throw new Error("Die Original-Rechnung hat keine Nummer und kann nicht storniert werden.");
  }

  const stornoNummer = await vergibNaechsteRechnungsnummer(new Date().getUTCFullYear());
  const now = new Date();

  const storno = await prisma.$transaction(async (tx) => {
    const neu = await tx.rechnung.create({
      data: {
        mietparteiId: original.mietparteiId,
        typ: original.typ,
        rechnungsnummer: stornoNummer,
        stornoVonId: original.id,
        zeitraumVon: original.zeitraumVon,
        zeitraumBis: original.zeitraumBis,
        status: "FREIGEGEBEN",
        ausstellungsdatum: now,
        freigegebenAm: now,
        // Zaehlerstaende bleiben als Referenz erhalten; alle Geldbetraege und der
        // Verbrauch werden negiert, sodass Original + Storno sich aufheben.
        anfangszaehlerstandKwh: original.anfangszaehlerstandKwh,
        endzaehlerstandKwh: original.endzaehlerstandKwh,
        gesamtVerbrauchKwh: -original.gesamtVerbrauchKwh,
        verbrauchGeschaetzt: original.verbrauchGeschaetzt,
        arbeitspreisNetto: original.arbeitspreisNetto,
        grundgebuehrMonatlichNetto: original.grundgebuehrMonatlichNetto,
        summeAbschlaegeBrutto: -original.summeAbschlaegeBrutto,
        verbrauchskostenBrutto: -original.verbrauchskostenBrutto,
        verrechnungBetrag: -original.verrechnungBetrag,
        positionen: {
          create: original.positionen.map((p) => ({
            bezeichnung: `Storno: ${p.bezeichnung}`,
            nettoBetrag: -p.nettoBetrag,
            steuersatzId: p.steuersatzId,
            steuerBetrag: -p.steuerBetrag,
            bruttoBetrag: -p.bruttoBetrag,
            sortierung: p.sortierung,
          })),
        },
      },
    });

    await tx.rechnung.update({ where: { id: original.id }, data: { status: "STORNIERT" } });
    return neu;
  });

  // PDF der Stornorechnung erzeugen.
  await generateAndStoreInvoicePdf(storno.id);

  // Storno dem Mieter per E-Mail zusenden (Fehler nicht fatal - Storno ist
  // erstellt; erneuter Versand ist ueber die Rechnung moeglich).
  try {
    const mitPdf = await prisma.rechnung.findUniqueOrThrow({
      where: { id: storno.id },
      include: { mietpartei: true },
    });
    if (mitPdf.pdfPfad) {
      const pdfBuffer = await readFile(resolvePdfFilePath(mitPdf.pdfPfad));
      const loginUrl = `${await getAppBaseUrl()}/login`;
      await sendMail({
        to: mitPdf.mietpartei.email,
        subject: `Stornorechnung ${stornoNummer} (zu ${original.rechnungsnummer})`,
        html: invoiceSentEmailHtml({ rechnungsnummer: stornoNummer, typ: mitPdf.typ, loginUrl }),
        attachments: [{ filename: `${stornoNummer}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });
      await prisma.rechnung.update({
        where: { id: storno.id },
        data: { status: "VERSENDET", versendetAm: new Date(), emailFehler: null },
      });
    }
  } catch (err) {
    await prisma.rechnung.update({
      where: { id: storno.id },
      data: { emailFehler: err instanceof Error ? err.message : "E-Mail-Versand fehlgeschlagen." },
    });
  }

  return { stornoRechnungId: storno.id };
}
