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
  const zurueckUrl = String(formData.get("zurueck") ?? "/admin");

  if (!einheitId || !Number.isFinite(kwh) || kwh < 0) {
    redirect(`${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}fehler=${encodeURIComponent("Ungültiger Zählerstand.")}`);
  }

  const zuordnung = await prisma.geraetZuordnung.findFirst({
    where: { einheitId, modus: "ADDIEREN" },
    orderBy: { createdAt: "asc" },
  });
  if (!zuordnung) {
    redirect(
      `${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(
        "Der Einheit ist kein (addierendes) Gerät zugeordnet - manueller Wert nicht möglich.",
      )}`,
    );
  }

  const geraetId = zuordnung.shellyGeraetId;
  const vorhandenePhase = await prisma.messwert.findFirst({
    where: { geraetId },
    select: { phase: true },
    orderBy: { timestamp: "desc" },
  });
  const phase = vorhandenePhase?.phase ?? "a";
  const timestamp = new Date();
  const energyWh = Math.round(kwh * 1000);

  await prisma.messwert.upsert({
    where: { geraetId_phase_timestamp: { geraetId, phase, timestamp } },
    update: { energyWh, quelle: "MANUELL" },
    create: { geraetId, phase, timestamp, energyWh, quelle: "MANUELL" },
  });

  revalidatePath("/admin");
  redirect(`${zurueckUrl}${zurueckUrl.includes("?") ? "&" : "?"}ok=1`);
}
