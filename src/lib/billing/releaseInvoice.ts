import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { generateAndStoreInvoicePdf, resolveRechnungsPdfPfad } from "@/lib/pdf/renderInvoicePdf";
import { sendMail } from "@/lib/mail/mailer";
import { invoiceSentEmailHtml } from "@/lib/mail/templates";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { vergibNaechsteRechnungsnummer } from "./invoiceNumber";
import { parseAusblick, berechneNettoAusBrutto } from "./ausblick";

/**
 * Übernimmt den an der Rechnung erfassten „Ausblick" (Preisänderung und/oder
 * neuer Abschlag) ins Mietprofil – idempotent (nur einmal, gesteuert über
 * `ausblickUebernommen`). Neue Preise überschreiben die aktuellen Werte der
 * Mietpartei; ein neuer Abschlag wird zum Gültig-ab-Datum angelegt und löst den
 * bisherigen ab (wie createAbschlagAction).
 */
async function uebernehmeAusblick(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({ where: { id: rechnungId } });
  if (rechnung.ausblickUebernommen) return;
  const ausblick = parseAusblick(rechnung.ausblick);
  if (!ausblick) return;

  const gueltigAb = new Date(ausblick.gueltigAb);

  await prisma.$transaction(async (tx) => {
    if (ausblick.preis) {
      await tx.mietpartei.update({
        where: { id: rechnung.mietparteiId },
        data: {
          arbeitspreisNetto: ausblick.preis.arbeitspreisNetto,
          arbeitspreisSteuersatzId: ausblick.preis.arbeitspreisSteuersatzId,
          grundpreisNetto: ausblick.preis.grundpreisNetto,
          grundpreisSteuersatzId: ausblick.preis.grundpreisNetto != null ? ausblick.preis.grundpreisSteuersatzId : null,
        },
      });
    }

    if (ausblick.abschlag) {
      const satz = await tx.steuersatz.findUnique({ where: { id: ausblick.abschlag.steuersatzId } });
      if (satz) {
        const tagVorNeu = new Date(gueltigAb);
        tagVorNeu.setDate(tagVorNeu.getDate() - 1);
        // Bisherigen (überschneidenden) Abschlag am Tag vor dem neuen Beginn beenden.
        await tx.abschlag.updateMany({
          where: {
            mietparteiId: rechnung.mietparteiId,
            gueltigAb: { lt: gueltigAb },
            OR: [{ gueltigBis: null }, { gueltigBis: { gte: gueltigAb } }],
          },
          data: { gueltigBis: tagVorNeu },
        });
        await tx.abschlag.create({
          data: {
            mietparteiId: rechnung.mietparteiId,
            bruttoBetrag: ausblick.abschlag.bruttoBetrag,
            nettoBetrag: berechneNettoAusBrutto(ausblick.abschlag.bruttoBetrag, satz.prozentsatz),
            steuersatzId: ausblick.abschlag.steuersatzId,
            gueltigAb,
          },
        });
      }
    }

    await tx.rechnung.update({ where: { id: rechnungId }, data: { ausblickUebernommen: true } });
  });
}

/**
 * Versucht, das Rechnungs-PDF per E-Mail an den Mieter zu versenden, und
 * protokolliert das Ergebnis am Datensatz:
 *  - Erfolg  -> status VERSENDET, versendetAm gesetzt, emailFehler = null
 *  - Fehler  -> status bleibt/wird FREIGEGEBEN, emailFehler = Meldung
 * So steht in der UI nie faelschlich "VERSENDET", wenn der Mailversand
 * gescheitert ist; die Rechnung kann dann gezielt erneut versendet werden.
 */
async function versendePerMail(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({
    where: { id: rechnungId },
    include: { mietpartei: true },
  });
  if (!rechnung.rechnungsnummer || !rechnung.pdfPfad) {
    throw new Error("Rechnung ist noch nicht freigegeben (keine Nummer/PDF).");
  }

  try {
    const pdfBuffer = await readFile(await resolveRechnungsPdfPfad(rechnung.mietparteiId, rechnung.pdfPfad));
    const loginUrl = `${await getAppBaseUrl()}/login`;
    await sendMail({
      to: rechnung.mietpartei.email,
      subject: `Ihre ${rechnung.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung"} ${rechnung.rechnungsnummer}`,
      html: invoiceSentEmailHtml({ rechnungsnummer: rechnung.rechnungsnummer, typ: rechnung.typ, loginUrl }),
      attachments: [
        { filename: `${rechnung.rechnungsnummer}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
      ],
    });
    await prisma.rechnung.update({
      where: { id: rechnungId },
      data: { status: "VERSENDET", versendetAm: new Date(), emailFehler: null },
    });
  } catch (err) {
    const meldung = err instanceof Error ? err.message : "Unbekannter Fehler beim E-Mail-Versand.";
    await prisma.rechnung.update({
      where: { id: rechnungId },
      // Status bleibt FREIGEGEBEN: Rechnung ist gueltig und dem Mieter im
      // Portal sichtbar, nur der Mailversand ist gescheitert.
      data: { emailFehler: meldung },
    });
    throw new Error(`E-Mail-Versand fehlgeschlagen: ${meldung}`);
  }
}

/**
 * Freigabe-Workflow: vergibt die (bis dahin fehlende) lueckenlose Rechnungs-
 * nummer, erzeugt das finale PDF mit dieser Nummer, macht die Rechnung im
 * Mieterbereich sichtbar (status FREIGEGEBEN) und versucht den E-Mail-Versand.
 * Ab der Freigabe ist die Rechnung unveraenderlich (Korrekturen nur ueber
 * Stornorechnung + neue Rechnung).
 */
export async function freigebenUndVersenden(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({ where: { id: rechnungId } });
  if (rechnung.status !== "ENTWURF") {
    throw new Error("Nur Entwürfe können freigegeben werden.");
  }

  // 1. Offizielle Nummer erst jetzt vergeben (lueckenlos - Entwuerfe verbrauchen
  //    keine Nummer). Massgeblich ist das Jahr des Abrechnungsendes.
  const rechnungsnummer = await vergibNaechsteRechnungsnummer(rechnung.zeitraumBis.getUTCFullYear());

  const now = new Date();
  await prisma.rechnung.update({
    where: { id: rechnungId },
    data: { status: "FREIGEGEBEN", freigegebenAm: now, rechnungsnummer },
  });

  // 1b. Erfassten Ausblick (neue Preise / neuer Abschlag) ins Mietprofil
  //     übernehmen (idempotent). Die Rechnungspositionen selbst bleiben
  //     unverändert (sie wurden beim Entwurf mit den damaligen Preisen erzeugt).
  await uebernehmeAusblick(rechnungId);

  // 2. Finales PDF MIT Nummer erzeugen (ueberschreibt den Entwurfs-PDF).
  await generateAndStoreInvoicePdf(rechnungId);

  // 3. Versenden (Fehler wird am Datensatz protokolliert und weitergereicht).
  await versendePerMail(rechnungId);
}

/**
 * Erneuter E-Mail-Versand einer bereits freigegebenen Rechnung (z.B. nachdem
 * ein zuvor gescheiterter Versand behoben wurde). Aendert die Rechnung selbst
 * nicht, nur den Versandstatus.
 */
export async function rechnungErneutVersenden(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({ where: { id: rechnungId } });
  if (rechnung.status !== "FREIGEGEBEN" && rechnung.status !== "VERSENDET") {
    throw new Error("Nur freigegebene Rechnungen können erneut versendet werden.");
  }
  await versendePerMail(rechnungId);
}
