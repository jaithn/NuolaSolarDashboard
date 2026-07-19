import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { renderOnboardingPdf, type OnboardingDokumentTyp } from "@/lib/pdf/renderOnboardingPdfs";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";
import { slugName } from "@/lib/dokumente";

// Liefert ALLE fuer diese Mietpartei relevanten Onboarding-Briefe als EIN
// zusammengefuehrtes PDF (in der Versand-Reihenfolge). Welche Dokumente enthalten
// sind, richtet sich nach den Onboarding-Optionen der Mietpartei:
//   1. Anschreiben (formal ODER persoenlich, je anschreibenVariante)
//   2. Stromliefervertrag (immer)
//   3. Ergaenzung zum Mietvertrag (nur wenn braucheErgaenzung)
//   4. SEPA-Lastschriftmandat (immer)
// Nur fuer Admins.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const mietpartei = await prisma.mietpartei.findUnique({
    where: { id },
    select: {
      anschreibenVariante: true,
      braucheErgaenzung: true,
      kundennummer: true,
      anrede: true,
      vorname: true,
      name: true,
      firma: true,
      vorname2: true,
      name2: true,
    },
  });
  if (!mietpartei) return NextResponse.json({ error: "Mietpartei nicht gefunden." }, { status: 404 });

  const anschreiben: OnboardingDokumentTyp =
    mietpartei.anschreibenVariante === "persoenlich" ? "anschreiben-persoenlich" : "anschreiben";
  const doks: OnboardingDokumentTyp[] = [anschreiben, "vertrag-eigenstaendig"];
  if (mietpartei.braucheErgaenzung) doks.push("vertrag-ergaenzung");
  doks.push("sepa");

  // Einzel-PDFs rendern und mit pdf-lib zu einem Dokument zusammenfuehren.
  const gesamt = await PDFDocument.create();
  for (const dok of doks) {
    const buffer = await renderOnboardingPdf(id, dok);
    const teil = await PDFDocument.load(buffer);
    const seiten = await gesamt.copyPages(teil, teil.getPageIndices());
    for (const seite of seiten) gesamt.addPage(seite);
  }
  const bytes = await gesamt.save();

  // Dateiname nach Schema: <Kundennummer>_<Name>_Onboarding-Unterlagen_<Datum>.pdf
  const kundennrTeil = mietpartei.kundennummer != null ? String(mietpartei.kundennummer) : "kunde";
  const nameTeil = slugName(mietparteiAnzeigeName(mietpartei));
  const datum = new Date().toISOString().slice(0, 10);
  const dateiname = `${kundennrTeil}_${nameTeil}_Onboarding-Unterlagen_${datum}.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dateiname}"`,
    },
  });
}
