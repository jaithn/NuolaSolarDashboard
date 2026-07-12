"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeShellyHost, pruefeGeraetErreichbar } from "@/lib/shelly/client";

export interface GeraetFormState {
  error?: string;
  // Nicht-fataler Hinweis (z.B. Gerät wurde angelegt, ist aber nicht erreichbar).
  warning?: string;
  success?: string;
}

// Standard-Abrufintervall in Minuten, falls keines angegeben ist.
const DEFAULT_ABRUF_INTERVALL_MINUTEN = 15;

function parseAbrufIntervall(formData: FormData): number {
  const raw = Number(formData.get("abrufIntervallMinuten"));
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_ABRUF_INTERVALL_MINUTEN;
  return Math.round(raw);
}

/**
 * Erreichbarkeitstest nach dem Anlegen/Ändern eines Geräts. Der Auth-Key wird
 * hier direkt aus der Umgebung gelesen (nicht auf Modulebene, s. Konvention).
 * Fehlt der Key, wird der Test übersprungen (kein Warnhinweis erzwungen).
 */
async function erreichbarkeitsHinweis(deviceId: string, serverHost: string): Promise<string | undefined> {
  const authKey = process.env.SHELLY_CLOUD_AUTH_KEY;
  if (!authKey) return undefined;
  const ergebnis = await pruefeGeraetErreichbar({ deviceId, server: serverHost }, { authKey });
  return ergebnis.ok && ergebnis.online ? undefined : ergebnis.meldung;
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
  const zeitpunktRaw = String(formData.get("zeitpunkt") ?? "");
  const kwh = Number(formData.get("kwh"));

  if (!geraetId || !zeitpunktRaw) {
    return { error: "Bitte Zeitpunkt und Zählerstand angeben." };
  }
  if (!Number.isFinite(kwh) || kwh < 0) {
    return { error: "Der Zählerstand ist ungültig." };
  }
  const zeitpunkt = new Date(zeitpunktRaw);
  if (Number.isNaN(zeitpunkt.getTime())) {
    return { error: "Der Zeitpunkt ist ungültig." };
  }

  // Phase wird nicht mehr abgefragt: der manuelle Zählerstand wird unter der
  // bereits vorhandenen Primär-Phase des Geräts abgelegt (bzw. "a" als Default),
  // damit er nahtlos in dieselbe Zählerstands-Reihe wie die automatischen
  // Messwerte einfließt und keine zusätzliche Phantom-Phase entsteht.
  const vorhandenePhase = await prisma.messwert.findFirst({
    where: { geraetId },
    select: { phase: true },
    orderBy: { timestamp: "desc" },
  });
  const phase = vorhandenePhase?.phase ?? "a";

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
  const serverHost = normalizeShellyHost(String(formData.get("serverHost") ?? ""));
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const abrufIntervallMinuten = parseAbrufIntervall(formData);

  if (!objektId || !deviceId || !serverHost || !bezeichnung) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  try {
    await prisma.shellyGeraet.create({
      data: { objektId, deviceId, serverHost, bezeichnung, abrufIntervallMinuten },
    });
  } catch {
    return { error: "Es existiert bereits ein Gerät mit dieser Device-ID auf diesem Server." };
  }

  revalidatePath("/admin/geraete");

  // Sofort nach dem Anlegen die Erreichbarkeit testen und ggf. warnen.
  const hinweis = await erreichbarkeitsHinweis(deviceId, serverHost);
  return hinweis ? { success: "Gerät angelegt.", warning: hinweis } : { success: "Gerät angelegt und erreichbar." };
}

export async function updateGeraetAction(
  _prevState: GeraetFormState,
  formData: FormData,
): Promise<GeraetFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const objektId = String(formData.get("objektId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const serverHost = normalizeShellyHost(String(formData.get("serverHost") ?? ""));
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const abrufIntervallMinuten = parseAbrufIntervall(formData);

  if (!objektId || !deviceId || !serverHost || !bezeichnung) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  try {
    await prisma.shellyGeraet.update({
      where: { id },
      data: { objektId, deviceId, serverHost, bezeichnung, abrufIntervallMinuten },
    });
  } catch {
    return { error: "Es existiert bereits ein Gerät mit dieser Device-ID auf diesem Server." };
  }

  revalidatePath("/admin/geraete");
  revalidatePath(`/admin/geraete/${id}`);

  const hinweis = await erreichbarkeitsHinweis(deviceId, serverHost);
  return hinweis ? { success: "Gespeichert.", warning: hinweis } : { success: "Gespeichert und erreichbar." };
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
