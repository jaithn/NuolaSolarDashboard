"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Trägt direkt aus der Verbrauchsübersicht einen manuellen (kumulativen)
 * Zählerstand für eine Einheit ein. Der Wert wird auf das primäre ADDIEREN-
 * Gerät der Einheit geschrieben (unter dessen vorhandener Phase, sonst "a") -
 * ohne Phasen-Abfrage, analog zur Geräte-Detailseite.
 */
export async function createEinheitManualMesswertAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const einheitId = String(formData.get("einheitId") ?? "");
  const kwh = Number(formData.get("kwh"));
  const datumRaw = String(formData.get("datum") ?? "");
  const zurueckUrl = String(formData.get("zurueck") ?? "/admin");

  if (!einheitId || !Number.isFinite(kwh) || kwh < 0) {
    redirect(`${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}fehler=${encodeURIComponent("Ungültiger Zählerstand.")}`);
  }
  // Datum ist Pflicht (nur Tagesdatum, kein Zeitstempel). Als Zeitpunkt wird
  // Mitternacht (UTC) des gewaehlten Tages gespeichert.
  const timestamp = new Date(`${datumRaw}T00:00:00.000Z`);
  if (!datumRaw || Number.isNaN(timestamp.getTime())) {
    redirect(`${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}fehler=${encodeURIComponent("Bitte ein gültiges Datum angeben.")}`);
  }

  const zuordnung = await prisma.geraetZuordnung.findFirst({
    where: { einheitId, modus: "ADDIEREN" },
    orderBy: { createdAt: "asc" },
  });

  let geraetId: string;
  if (zuordnung) {
    geraetId = zuordnung.shellyGeraetId;
  } else {
    // Kein Zaehler zugeordnet -> automatisch einen virtuellen „Manueller Zähler"
    // anlegen und der Einheit zuordnen. Nicht pollbar (serverHost leer, aktiv=false),
    // damit der Worker ihn ignoriert; die Verbrauchsberechnung liest die Messwerte
    // dennoch. So sind manuelle Zaehlerstaende auch ohne echtes Geraet moeglich.
    const einheit = await prisma.einheit.findUniqueOrThrow({ where: { id: einheitId }, select: { objektId: true } });
    const geraet = await prisma.shellyGeraet.upsert({
      where: { deviceId_serverHost: { deviceId: `manuell-${einheitId}`, serverHost: "" } },
      update: {},
      create: {
        objektId: einheit.objektId,
        deviceId: `manuell-${einheitId}`,
        serverHost: "",
        bezeichnung: "Manueller Zähler",
        aktiv: false,
      },
    });
    const bereitsZugeordnet = await prisma.geraetZuordnung.findFirst({
      where: { einheitId, shellyGeraetId: geraet.id },
    });
    if (!bereitsZugeordnet) {
      await prisma.geraetZuordnung.create({ data: { einheitId, shellyGeraetId: geraet.id, modus: "ADDIEREN" } });
    }
    geraetId = geraet.id;
  }
  const vorhandenePhase = await prisma.messwert.findFirst({
    where: { geraetId },
    select: { phase: true },
    orderBy: { timestamp: "desc" },
  });
  const phase = vorhandenePhase?.phase ?? "a";
  const energyWh = Math.round(kwh * 1000);

  await prisma.messwert.upsert({
    where: { geraetId_phase_timestamp: { geraetId, phase, timestamp } },
    update: { energyWh, quelle: "MANUELL" },
    create: { geraetId, phase, timestamp, energyWh, quelle: "MANUELL" },
  });

  revalidatePath("/admin");
  redirect(`${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}ok=1`);
}
