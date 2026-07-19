import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { resolveRechnungsPdfPfad } from "@/lib/pdf/renderInvoicePdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const rechnung = await prisma.rechnung.findUnique({ where: { id } });
  if (!rechnung || !rechnung.pdfPfad) {
    return NextResponse.json({ error: "PDF nicht gefunden." }, { status: 404 });
  }

  if (session.role === "MIETER") {
    const nutzer = await prisma.nutzer.findUnique({ where: { id: session.userId } });
    if (!nutzer || nutzer.mietparteiId !== rechnung.mietparteiId) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
    }
    if (rechnung.status === "ENTWURF") {
      return NextResponse.json({ error: "Diese Rechnung ist noch nicht freigegeben." }, { status: 403 });
    }
  } else if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const buffer = await readFile(await resolveRechnungsPdfPfad(rechnung.mietparteiId, rechnung.pdfPfad));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rechnung.rechnungsnummer ?? "Entwurf-" + rechnung.id}.pdf"`,
    },
  });
}
