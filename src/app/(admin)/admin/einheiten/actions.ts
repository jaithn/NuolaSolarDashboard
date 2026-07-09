"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export interface ZuordnungFormState {
  error?: string;
}

export async function createZuordnungAction(
  _prevState: ZuordnungFormState,
  formData: FormData,
): Promise<ZuordnungFormState> {
  const einheitId = String(formData.get("einheitId") ?? "");
  const shellyGeraetId = String(formData.get("shellyGeraetId") ?? "");
  const modus = String(formData.get("modus") ?? "ADDIEREN") as "ADDIEREN" | "SUBTRAHIEREN";

  if (!einheitId || !shellyGeraetId) {
    return { error: "Bitte ein Gerät auswählen." };
  }

  try {
    await prisma.geraetZuordnung.create({
      data: { einheitId, shellyGeraetId, modus },
    });
  } catch {
    return { error: "Dieses Gerät ist dieser Einheit bereits zugeordnet." };
  }

  revalidatePath(`/admin/einheiten/${einheitId}`);
  return {};
}

export async function deleteZuordnungAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const einheitId = String(formData.get("einheitId") ?? "");

  await prisma.geraetZuordnung.delete({ where: { id } });
  revalidatePath(`/admin/einheiten/${einheitId}`);
}
