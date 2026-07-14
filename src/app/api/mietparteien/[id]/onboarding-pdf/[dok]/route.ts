import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import {
  renderOnboardingPdf,
  ONBOARDING_DOKUMENT_TITEL,
  type OnboardingDokumentTyp,
} from "@/lib/pdf/renderOnboardingPdfs";

const GUELTIGE_DOKS: OnboardingDokumentTyp[] = [
  "anschreiben",
  "vertrag-eigenstaendig",
  "vertrag-ergaenzung",
  "sepa",
];

// Rendert eines der drei Onboarding-Dokumente (Anschreiben, Vertrag, SEPA-Mandat)
// als PDF. Nur fuer Admins. Wird nirgends gespeichert, sondern bei jedem Abruf
// frisch aus den aktuellen Stammdaten erzeugt.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dok: string }> },
) {
  const { id, dok } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  if (!GUELTIGE_DOKS.includes(dok as OnboardingDokumentTyp)) {
    return NextResponse.json({ error: "Unbekanntes Dokument." }, { status: 404 });
  }
  const dokTyp = dok as OnboardingDokumentTyp;

  const buffer = await renderOnboardingPdf(id, dokTyp);
  const dateiname = `${ONBOARDING_DOKUMENT_TITEL[dokTyp]}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dateiname}"`,
    },
  });
}
