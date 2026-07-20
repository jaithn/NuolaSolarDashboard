"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export interface ZuordnungFormState {
  error?: string;
}

export async function createZuordnungAction(
  _prevState: ZuordnungFormState,
  formData: FormData,
): Promise<ZuordnungFormState> {
  await requireAdmin();

  const einheitId = String(formData.get("einheitId") ?? "");
  const shellyGeraetId = String(formData.get("shellyGeraetId") ?? "");
  const modus = String(formData.get("modus") ?? "ADDIEREN") as "ADDIEREN" | "SUBTRAHIEREN";
  // Nur bei Allgemeinstrom relevant: markiert den Zaehler als Waermepumpe (getrennter
  // Rechnungsausweis - nur Arbeitspreis). Ein SUBTRAHIEREN-Zaehler ist nie WP.
  const istWaermepumpe = formData.get("istWaermepumpe") === "on" && modus === "ADDIEREN";

  if (!einheitId || !shellyGeraetId) {
    return { error: "Bitte einen Zähler auswählen." };
  }

  try {
    await prisma.geraetZuordnung.create({
      data: { einheitId, shellyGeraetId, modus, istWaermepumpe },
    });
  } catch {
    return { error: "Dieser Zähler ist dieser Einheit bereits zugeordnet." };
  }

  revalidatePath(`/admin/einheiten/${einheitId}`);
  return {};
}

/**
 * Markiert eine bestehende Zähler-Zuordnung nachträglich als Wärmepumpe (bzw.
 * hebt die Markierung wieder auf). So lässt sich bei einer Allgemeinstrom-Einheit
 * die Wärmepumpe jederzeit ergänzen, ohne dass Allgemeinstrom und Wärmepumpe als
 * getrennte Parteien laufen. Nur ADDIEREN-Zähler können Wärmepumpe sein.
 */
export async function setZuordnungWaermepumpeAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const einheitId = String(formData.get("einheitId") ?? "");
  const wert = String(formData.get("wert") ?? "") === "an";
  if (!id) return;

  const zuordnung = await prisma.geraetZuordnung.findUnique({ where: { id } });
  // Ein SUBTRAHIEREN-Zaehler (Allgemeinstrom-Zwischenzaehler) ist nie Waermepumpe.
  const istWaermepumpe = wert && zuordnung?.modus === "ADDIEREN";

  await prisma.geraetZuordnung.update({ where: { id }, data: { istWaermepumpe } });
  revalidatePath(`/admin/einheiten/${einheitId}`);
}

export async function deleteZuordnungAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const einheitId = String(formData.get("einheitId") ?? "");

  await prisma.geraetZuordnung.delete({ where: { id } });
  revalidatePath(`/admin/einheiten/${einheitId}`);
}
