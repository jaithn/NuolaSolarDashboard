"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createZugangForMietpartei } from "@/lib/auth/onboarding";

export interface MietparteiFormState {
  error?: string;
}

function parseMietparteiInput(formData: FormData) {
  const einheitId = String(formData.get("einheitId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const einzugsdatumRaw = String(formData.get("einzugsdatum") ?? "");
  const auszugsdatumRaw = String(formData.get("auszugsdatum") ?? "");
  const status = String(formData.get("status") ?? "AKTIV") as "AKTIV" | "INAKTIV";
  const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
  const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
  const hatGrundpreis = formData.get("hatGrundpreis") === "on";
  const grundpreisNetto = Number(formData.get("grundpreisNetto"));
  const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");

  if (!einheitId || !name || !email || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." } as const;
  }
  // Strikte E-Mail-Validierung: verhindert u.a. Zeilenumbrueche/Sonderzeichen
  // in der Empfaengeradresse (SMTP-Header-Injection) bei Onboarding- und
  // Rechnungsmails.
  if (!z.string().email().max(254).safeParse(email).success) {
    return { error: "Die E-Mail-Adresse ist ungültig." } as const;
  }
  if (!Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
    return { error: "Der Arbeitspreis ist ungültig." } as const;
  }

  return {
    data: {
      einheitId,
      name,
      email,
      telefon: telefon || null,
      anschrift: anschrift || null,
      einzugsdatum: new Date(einzugsdatumRaw),
      auszugsdatum: auszugsdatumRaw ? new Date(auszugsdatumRaw) : null,
      status,
      arbeitspreisNetto,
      arbeitspreisSteuersatzId,
      grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
      grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
    },
  } as const;
}

export async function createMietparteiAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const parsed = parseMietparteiInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.mietpartei.create({ data: parsed.data });
  revalidatePath("/admin/mietparteien");
  return {};
}

export async function updateMietparteiAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = parseMietparteiInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.mietpartei.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/mietparteien");
  revalidatePath(`/admin/mietparteien/${id}`);
  return {};
}

export interface AbschlagFormState {
  error?: string;
}

export async function createAbschlagAction(
  _prevState: AbschlagFormState,
  formData: FormData,
): Promise<AbschlagFormState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const nettoBetrag = Number(formData.get("nettoBetrag"));
  const steuersatzId = String(formData.get("steuersatzId") ?? "");
  const gueltigAbRaw = String(formData.get("gueltigAb") ?? "");
  const gueltigBisRaw = String(formData.get("gueltigBis") ?? "");

  if (!steuersatzId || !gueltigAbRaw || !Number.isFinite(nettoBetrag) || nettoBetrag < 0) {
    return { error: "Bitte Betrag, Steuersatz und Gültig-ab-Datum angeben." };
  }

  await prisma.abschlag.create({
    data: {
      mietparteiId,
      nettoBetrag,
      steuersatzId,
      gueltigAb: new Date(gueltigAbRaw),
      gueltigBis: gueltigBisRaw ? new Date(gueltigBisRaw) : null,
    },
  });

  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return {};
}

export async function createZugangAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");

  // WICHTIG: redirect() wirft intern einen speziellen NEXT_REDIRECT-Fehler,
  // der die Next.js-Navigation ausloest - darf daher NICHT innerhalb des
  // try/catch aufgerufen werden, sonst wuerde er faelschlich als Fehler
  // dieser Aktion abgefangen.
  let errorMessage: string | null = null;
  try {
    await createZugangForMietpartei(mietparteiId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Zugang konnte nicht angelegt werden.";
  }

  if (errorMessage) {
    redirect(`/admin/mietparteien/${mietparteiId}?fehler=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/admin/mietparteien/${mietparteiId}?zugang=ok`);
}
