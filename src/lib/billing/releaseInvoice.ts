import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { generateAndStoreInvoicePdf, resolvePdfFilePath } from "@/lib/pdf/renderInvoicePdf";
import { sendMail } from "@/lib/mail/mailer";
import { invoiceSentEmailHtml } from "@/lib/mail/templates";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  return value;
}

/**
 * Freigabe-Workflow: generiert (falls noch nicht geschehen) das PDF, macht
 * die Rechnung im Mieterbereich sichtbar und verschickt sie per E-Mail -
 * beides in einem Schritt, wie im Auftrag als gemeinsamer Freigabe-Vorgang
 * beschrieben. Einmal versendete Rechnungen sind unveraenderlich (siehe
 * Auftrag: Korrekturen nur ueber Stornorechnung + neue Rechnung).
 */
export async function freigebenUndVersenden(rechnungId: string): Promise<void> {
  const rechnung = await prisma.rechnung.findUniqueOrThrow({
    where: { id: rechnungId },
    include: { mietpartei: true },
  });
  if (rechnung.status !== "ENTWURF") {
    throw new Error("Nur Entwürfe können freigegeben werden.");
  }

  const filename = rechnung.pdfPfad ?? (await generateAndStoreInvoicePdf(rechnungId));
  const pdfBuffer = await readFile(resolvePdfFilePath(filename));

  const now = new Date();
  await prisma.rechnung.update({
    where: { id: rechnungId },
    data: { status: "VERSENDET", freigegebenAm: now, versendetAm: now, pdfPfad: filename },
  });

  const loginUrl = `${requireEnv("APP_BASE_URL")}/login`;
  await sendMail({
    to: rechnung.mietpartei.email,
    subject: `Ihre ${rechnung.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung"} ${rechnung.rechnungsnummer}`,
    html: invoiceSentEmailHtml({ rechnungsnummer: rechnung.rechnungsnummer, typ: rechnung.typ, loginUrl }),
    attachments: [{ filename: `${rechnung.rechnungsnummer}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
  });
}
