import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { renderWelcomeLetterPdf } from "@/lib/pdf/renderWelcomeLetter";

// POST statt GET: Benutzername + Passwort werden im Body uebergeben (das
// Klartext-Passwort existiert nur transient direkt nach dem Anlegen des
// Zugangs und wird nirgends gespeichert). Nur fuer Admins.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const form = await req.formData();
  const benutzername = String(form.get("benutzername") ?? "").trim();
  const passwort = String(form.get("passwort") ?? "");
  if (!benutzername || !passwort) {
    return NextResponse.json({ error: "Benutzername und Passwort erforderlich." }, { status: 400 });
  }

  const buffer = await renderWelcomeLetterPdf({ mietparteiId: id, benutzername, passwort });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Willkommensbrief.pdf"`,
    },
  });
}
