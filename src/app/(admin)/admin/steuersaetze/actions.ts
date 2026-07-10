"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export interface SteuersatzFormState {
  error?: string;
}

export async function createSteuersatzAction(
  _prevState: SteuersatzFormState,
  formData: FormData,
): Promise<SteuersatzFormState> {
  await requireAdmin();

  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const prozentsatz = Number(formData.get("prozentsatz"));
  const gueltigAbRaw = String(formData.get("gueltigAb") ?? "");
  const gueltigBisRaw = String(formData.get("gueltigBis") ?? "");

  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };
  if (!Number.isFinite(prozentsatz) || prozentsatz < 0 || prozentsatz > 100) {
    return { error: "Der Prozentsatz muss zwischen 0 und 100 liegen." };
  }
  if (!gueltigAbRaw) return { error: "Bitte ein Gültig-ab-Datum angeben." };

  await prisma.steuersatz.create({
    data: {
      bezeichnung,
      prozentsatz,
      gueltigAb: new Date(gueltigAbRaw),
      gueltigBis: gueltigBisRaw ? new Date(gueltigBisRaw) : null,
    },
  });

  revalidatePath("/admin/steuersaetze");
  return {};
}
