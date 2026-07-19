import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { renderOnboardingPdf } from "@/lib/pdf/renderOnboardingPdfs";

// Liefert das SEPA-Lastschriftmandat der eingeloggten Mietpartei als PDF -
// vorausgefuellt mit ihrer aktuell hinterlegten Bankverbindung. Wird im Portal
// nach einer IBAN-Aenderung zum Herunterladen/Unterschreiben angeboten.
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "MIETER") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const nutzer = await prisma.nutzer.findUnique({
    where: { id: session.userId },
    select: { mietparteiId: true },
  });
  if (!nutzer?.mietparteiId) {
    return NextResponse.json({ error: "Keine Mietpartei." }, { status: 404 });
  }

  const buffer = await renderOnboardingPdf(nutzer.mietparteiId, "sepa");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="SEPA-Lastschriftmandat.pdf"',
    },
  });
}
