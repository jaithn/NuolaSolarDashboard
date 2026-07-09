import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

  const von = vonRaw ? new Date(vonRaw) : new Date(0);
  const bis = bisRaw ? new Date(bisRaw) : new Date();

  const messwerte = await prisma.messwert.findMany({
    where: {
      timestamp: { gte: von, lte: bis },
      geraet: objektId ? { objektId } : undefined,
    },
    include: { geraet: { include: { objekt: true, zuordnungen: { include: { einheit: true } } } } },
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
