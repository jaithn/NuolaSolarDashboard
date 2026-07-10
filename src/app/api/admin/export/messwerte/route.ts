import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";

function csvEscape(value: string): string {
  // Schutz vor CSV-/Formel-Injection: Zellen, die mit =, +, -, @ oder
  // Steuerzeichen beginnen, wuerden von Excel/LibreOffice als Formel
  // interpretiert - einfaches Anfuehrungszeichen voranstellen.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function parseDateParam(raw: string | null, fallback: Date): Date | null {
  if (!raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const vonRaw = searchParams.get("von");
  const bisRaw = searchParams.get("bis");
  const objektId = searchParams.get("objektId") ?? undefined;

  const von = parseDateParam(vonRaw, new Date(0));
  const bis = parseDateParam(bisRaw, new Date());
  if (!von || !bis) {
    return NextResponse.json({ error: "Ungültiger Datumsparameter." }, { status: 400 });
  }

  const messwerte = await prisma.messwert.findMany({
    where: {
      timestamp: { gte: von, lte: bis },
      geraet: objektId ? { objektId } : undefined,
    },
    // Nur die tatsaechlich exportierten Felder selektieren - die Tabelle
    // waechst unbegrenzt, volle Relations-Objekte je Zeile waeren unnoetig
    // speicherintensiv.
    select: {
      phase: true,
      timestamp: true,
      energyWh: true,
      geraet: {
        select: {
          bezeichnung: true,
          deviceId: true,
          objekt: { select: { name: true } },
          zuordnungen: { select: { einheit: { select: { bezeichnung: true } } } },
        },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  const header = "Objekt,Einheiten,Geraet,DeviceId,Phase,Zeitstempel,EnergieWh";
  const rows = messwerte.map((m) =>
    [
      m.geraet.objekt.name,
      m.geraet.zuordnungen.map((z) => z.einheit.bezeichnung).join(" / "),
      m.geraet.bezeichnung,
      m.geraet.deviceId,
      m.phase,
      m.timestamp.toISOString(),
      String(m.energyWh),
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="messwerte-export.csv"`,
    },
  });
}
