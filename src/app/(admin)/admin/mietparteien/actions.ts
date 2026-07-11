"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createZugangForMietpartei } from "@/lib/auth/onboarding";

export interface MietparteiFormState {
  error?: string;
  // Rohwerte zum Wiederbefuellen des Formulars nach einem Validierungsfehler
  // (React 19 setzt unkontrollierte Felder sonst nach der Server-Action zurueck).
  values?: Record<string, string>;
}

// Alle rohen Formularwerte fuer die Wiederbefuellung einsammeln.
function collectValues(formData: FormData): Record<string, string> {
  const keys = [
    "einheitId",
    "name",
    "email",
    "telefon",
    "einzugsdatum",
    "auszugsdatum",
    "status",
    "arbeitspreisNetto",
    "arbeitspreisSteuersatzId",
    "hatGrundpreis",
    "grundpreisNetto",
    "grundpreisSteuersatzId",
    "abschlagNetto",
    "abschlagSteuersatzId",
    "abschlagGueltigAb",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

type ParsedMietpartei = {
  einheitId: string;
  name: string;
  email: string;
  telefon: string | null;
  // anschrift entfaellt bewusst: die Anschrift einer Mietpartei entspricht der
  // Objektadresse (siehe Objekt.adresse/plz/ort) und wird von dort abgeleitet.
  anschrift: null;
  einzugsdatum: Date;
  auszugsdatum: Date | null;
  status: "AKTIV" | "INAKTIV";
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
};

function parseMietparteiInput(formData: FormData): { error: string } | { data: ParsedMietpartei } {
  const einheitId = String(formData.get("einheitId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const einzugsdatumRaw = String(formData.get("einzugsdatum") ?? "");
  const auszugsdatumRaw = String(formData.get("auszugsdatum") ?? "");
  const status = String(formData.get("status") ?? "AKTIV") as "AKTIV" | "INAKTIV";
  const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
  const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
  const hatGrundpreis = formData.get("hatGrundpreis") === "on";
  const grundpreisNetto = Number(formData.get("grundpreisNetto"));
  const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");

  if (!einheitId || !name || !email || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }
  // Strikte E-Mail-Validierung: verhindert u.a. Zeilenumbrueche/Sonderzeichen
  // in der Empfaengeradresse (SMTP-Header-Injection) bei Onboarding- und
  // Rechnungsmails.
  if (!z.string().email().max(254).safeParse(email).success) {
    return { error: "Die E-Mail-Adresse ist ungültig." };
  }
  if (!Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
    return { error: "Der Arbeitspreis ist ungültig." };
  }

  return {
    data: {
      einheitId,
      name,
      email,
      telefon: telefon || null,
      anschrift: null,
      einzugsdatum: new Date(einzugsdatumRaw),
      auszugsdatum: auszugsdatumRaw ? new Date(auszugsdatumRaw) : null,
      status,
      arbeitspreisNetto,
      arbeitspreisSteuersatzId,
      grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
      grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
    },
  };
}

export async function createMietparteiAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const parsed = parseMietparteiInput(formData);
  if ("error" in parsed) return { error: parsed.error, values: collectValues(formData) };

  // Optionaler Abschlag direkt beim Anlegen. Standard-Gueltigkeitsbeginn ist
  // das Einzugsdatum (falls im Formular nicht anders gesetzt).
  const abschlagNetto = Number(formData.get("abschlagNetto"));
  const abschlagSteuersatzId = String(formData.get("abschlagSteuersatzId") ?? "");
  const abschlagGueltigAbRaw = String(formData.get("abschlagGueltigAb") ?? "");
  const legeAbschlagAn = Number.isFinite(abschlagNetto) && abschlagNetto > 0 && abschlagSteuersatzId;

  await prisma.$transaction(async (tx) => {
    const mietpartei = await tx.mietpartei.create({ data: parsed.data });
    if (legeAbschlagAn) {
      await tx.abschlag.create({
        data: {
          mietparteiId: mietpartei.id,
          nettoBetrag: abschlagNetto,
          steuersatzId: abschlagSteuersatzId,
          gueltigAb: abschlagGueltigAbRaw ? new Date(abschlagGueltigAbRaw) : parsed.data.einzugsdatum,
        },
      });
    }
  });

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
  if ("error" in parsed) return { error: parsed.error, values: collectValues(formData) };

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

  const gueltigAb = new Date(gueltigAbRaw);
  // Der neue Abschlag loest den bisherigen ab: alle noch offenen (gueltigBis
  // = null) Abschlaege, die vor dem neuen beginnen, werden am Tag vor dem
  // neuen Gueltigkeitsbeginn beendet - so gibt es keine Ueberschneidung und
  // keine Doppelberechnung in der Rechnung.
  const tagVorNeu = new Date(gueltigAb);
  tagVorNeu.setDate(tagVorNeu.getDate() - 1);

  await prisma.$transaction(async (tx) => {
    await tx.abschlag.updateMany({
      where: { mietparteiId, gueltigBis: null, gueltigAb: { lt: gueltigAb } },
      data: { gueltigBis: tagVorNeu },
    });
    await tx.abschlag.create({
      data: {
        mietparteiId,
        nettoBetrag,
        steuersatzId,
        gueltigAb,
        gueltigBis: gueltigBisRaw ? new Date(gueltigBisRaw) : null,
      },
    });
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
