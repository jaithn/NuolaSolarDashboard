import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { resolveDokumentPfad } from "@/lib/dokumente";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// Liefert ein gescanntes Mietpartei-Dokument aus dem data-Volume aus. Nur fuer
// Admins (personenbezogene Vertragsunterlagen).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dokId: string }> },
) {
  const { id, dokId } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const dok = await prisma.mietparteiDokument.findUnique({ where: { id: dokId } });
  if (!dok || dok.mietparteiId !== id) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(dok.pfad).toLowerCase()] ?? "application/octet-stream";
  const buffer = await readFile(resolveDokumentPfad(dok.mietparteiId, dok.pfad)).catch(() => null);
  if (!buffer) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(dok.dateiname)}"`,
    },
  });
}
