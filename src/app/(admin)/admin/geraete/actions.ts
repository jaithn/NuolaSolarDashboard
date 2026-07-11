"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export interface GeraetFormState {
  error?: string;
}

export interface ManualMesswertState {
  error?: string;
  success?: string;
}

export async function createManualMesswertAction(
  _prevState: ManualMesswertState,
  formData: FormData,
): Promise<ManualMesswertState> {
  await requireAdmin();

  const geraetId = String(formData.get("geraetId") ?? "");
  const phase = String(formData.get("phase") ?? "").trim();
  const zeitpunktRaw = String(formData.get("zeitpunkt") ?? "");
  const kwh = Number(formData.get("kwh"));

  if (!geraetId || !phase || !zeitpunktRaw) {
    return { error: "Bitte Phase, Zeitpunkt und Zählerstand angeben." };
  }
  if (!Number.isFinite(kwh) || kwh < 0) {
    return { error: "Der Zählerstand ist ungültig." };
  }
  const zeitpunkt = new Date(zeitpunktRaw);
  if (Number.isNaN(zeitpunkt.getTime())) {
    return { error: "Der Zeitpunkt ist ungültig." };
  }

  // Zaehlerstand wird als kumulativer Wh-Wert gespeichert (Eingabe in kWh).
  const energyWh = Math.round(kwh * 1000);
  await prisma.messwert.upsert({
    where: { geraetId_phase_timestamp: { geraetId, phase, timestamp: zeitpunkt } },
    update: { energyWh, quelle: "MANUELL" },
    create: { geraetId, phase, timestamp: zeitpunkt, energyWh, quelle: "MANUELL" },
  });

  revalidatePath(`/admin/geraete/${geraetId}`);
  return { success: "Manueller Messwert gespeichert." };
}

export async function createGeraetAction(
  _prevState: GeraetFormState,
  formData: FormData,
): Promise<GeraetFormState> {
  await requireAdmin();

  const objektId = String(formData.get("objektId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const serverHost = String(formData.get("serverHost") ?? "").trim();
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();

  if (!objektId || !deviceId || !serverHost || !bezeichnung) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  try {
    await prisma.shellyGeraet.create({
      data: { objektId, deviceId, serverHost, bezeichnung },
    });
  } catch {
    return { error: "Es existiert bereits ein Gerät mit dieser Device-ID auf diesem Server." };
  }

  revalidatePath("/admin/geraete");
  return {};
}

export async function updateGeraetAction(
  _prevState: GeraetFormState,
  formData: FormData,
): Promise<GeraetFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const objektId = String(formData.get("objektId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const serverHost = String(formData.get("serverHost") ?? "").trim();
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();

  if (!objektId || !deviceId || !serverHost || !bezeichnung) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  try {
    await prisma.shellyGeraet.update({
      where: { id },
      data: { objektId, deviceId, serverHost, bezeichnung },
    });
  } catch {
    return { error: "Es existiert bereits ein Gerät mit dieser Device-ID auf diesem Server." };
  }

  revalidatePath("/admin/geraete");
  revalidatePath(`/admin/geraete/${id}`);
  return {};
}

export async function toggleGeraetAktivAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const geraet = await prisma.shellyGeraet.findUniqueOrThrow({ where: { id } });

  await prisma.shellyGeraet.update({
    where: { id },
    data: {
      aktiv: !geraet.aktiv,
      deaktiviertAb: geraet.aktiv ? new Date() : null,
    },
  });

  revalidatePath("/admin/geraete");
  revalidatePath(`/admin/geraete/${id}`);
  redirect(`/admin/geraete/${id}`);
}

export async function deleteGeraetAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const messwerteCount = await prisma.messwert.count({ where: { geraetId: id } });

  if (messwerteCount > 0) {
    redirect(
      `/admin/geraete?fehler=${encodeURIComponent(
        "Gerät hat bereits historische Messwerte und kann nicht gelöscht werden - stattdessen deaktivieren.",
      )}`,
    );
  }

  await prisma.shellyGeraet.delete({ where: { id } });
  revalidatePath("/admin/geraete");
  redirect("/admin/geraete");
}
