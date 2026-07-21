"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  erstelleRechnungsentwurf,
  erstelleEntwuerfeFuerAktiveEinheiten,
  UeberschneidendeRechnungError,
} from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { freigebenUndVersenden, rechnungErneutVersenden } from "@/lib/billing/releaseInvoice";
import { storniereRechnung } from "@/lib/billing/storno";
import { loescheRechnungsentwurf } from "@/lib/billing/deleteDraft";
import type { AusblickDaten } from "@/lib/billing/ausblick";

export interface RechnungFormState {
  error?: string;
  success?: string;
  // Bei Zeitraum-Ueberschneidung: fuehrt den Nutzer durch den Workflow.
  konflikt?: {
    existierendeRechnungId: string;
    istEntwurf: boolean;
    rechnungsnummer: string | null;
  };
}

export async function createRechnungsentwurfAction(
  _prevState: RechnungFormState,
  formData: FormData,
): Promise<RechnungFormState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const typ = String(formData.get("typ") ?? "JAHRESABRECHNUNG") as "JAHRESABRECHNUNG" | "SCHLUSSRECHNUNG";
  const vonRaw = String(formData.get("von") ?? "");
  const bisRaw = String(formData.get("bis") ?? "");

  if (!mietparteiId || !vonRaw || !bisRaw) {
    return { error: "Bitte Mietpartei sowie Zeitraum angeben." };
  }
  const von = new Date(vonRaw);
  const bis = new Date(bisRaw);
  if (von > bis) {
    return { error: "Das Von-Datum muss vor dem Bis-Datum liegen." };
  }

  let rechnungId: string;
  try {
    const result = await erstelleRechnungsentwurf({ mietparteiId, typ, von, bis });
    rechnungId = result.rechnungId;
    await generateAndStoreInvoicePdf(rechnungId);
  } catch (err) {
    if (err instanceof UeberschneidendeRechnungError) {
      return {
        error: err.message,
        konflikt: {
          existierendeRechnungId: err.existierendeRechnungId,
          istEntwurf: err.istEntwurf,
          rechnungsnummer: err.rechnungsnummer,
        },
      };
    }
    return { error: err instanceof Error ? err.message : "Rechnung konnte nicht erstellt werden." };
  }

  revalidatePath("/admin/rechnungen");
  redirect(`/admin/rechnungen/${rechnungId}`);
}

export interface AusblickFormState {
  error?: string;
  success?: string;
  savedNonce?: string;
}

/**
 * Speichert den „Ausblick" (Preisänderung und/oder neuer Abschlag ab der
 * nächsten Periode) an einem Rechnungs-ENTWURF. Er wird auf dem PDF ausgewiesen
 * und bei der Freigabe ins Mietprofil übernommen. Ohne aktivierten Punkt wird
 * der Ausblick geleert. Danach wird das Entwurfs-PDF neu erzeugt (Vorschau).
 */
export async function setAusblickAction(
  _prevState: AusblickFormState,
  formData: FormData,
): Promise<AusblickFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Rechnung fehlt." };
  const rechnung = await prisma.rechnung.findUnique({ where: { id } });
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status !== "ENTWURF") {
    return { error: "Der Ausblick lässt sich nur an einem Entwurf ändern." };
  }

  const gueltigAb = String(formData.get("gueltigAb") ?? "");
  if (!gueltigAb) return { error: "Bitte ein Datum angeben, ab wann die Änderungen gelten." };

  const preisAktiv = formData.get("preisAktiv") === "on";
  const abschlagAktiv = formData.get("abschlagAktiv") === "on";

  let preis: AusblickDaten["preis"] = null;
  if (preisAktiv) {
    const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
    const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
    if (!arbeitspreisSteuersatzId || !Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
      return { error: "Bitte einen gültigen neuen Arbeitspreis und Steuersatz angeben." };
    }
    const hatGrundpreis = formData.get("hatGrundpreis") === "on";
    const grundpreisNettoRaw = Number(formData.get("grundpreisNetto"));
    const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");
    const grund = String(formData.get("grund") ?? "").trim();
    if (!grund) return { error: "Bitte den Grund für die Preisänderung angeben." };
    preis = {
      arbeitspreisNetto,
      arbeitspreisSteuersatzId,
      grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNettoRaw) ? grundpreisNettoRaw : null,
      grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
      grund,
    };
  }

  let abschlag: AusblickDaten["abschlag"] = null;
  if (abschlagAktiv) {
    const bruttoBetrag = Number(formData.get("abschlagBrutto"));
    const steuersatzId = String(formData.get("abschlagSteuersatzId") ?? "");
    if (!steuersatzId || !Number.isFinite(bruttoBetrag) || bruttoBetrag <= 0) {
      return { error: "Bitte einen gültigen neuen Abschlag (inkl. MwSt.) und Steuersatz angeben." };
    }
    abschlag = { bruttoBetrag, steuersatzId };
  }

  const ausblick: AusblickDaten | null = preis || abschlag ? { gueltigAb, preis, abschlag } : null;

  await prisma.rechnung.update({
    where: { id },
    data: {
      // Prisma-Json: DbNull setzt die Spalte auf SQL-NULL (Ausblick geleert).
      ausblick: ausblick ? (ausblick as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      ausblickUebernommen: false,
    },
  });

  // Entwurfs-PDF neu erzeugen, damit die Vorschau den Ausblick zeigt.
  await generateAndStoreInvoicePdf(id);

  revalidatePath(`/admin/rechnungen/${id}`);
  return {
    success: ausblick ? "Ausblick gespeichert – in der PDF-Vorschau sichtbar." : "Ausblick entfernt.",
    savedNonce: Date.now().toString(),
  };
}

export async function freigebenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  let errorMessage: string | null = null;
  try {
    await freigebenUndVersenden(id);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Freigabe fehlgeschlagen.";
  }

  revalidatePath("/admin/rechnungen");
  revalidatePath(`/admin/rechnungen/${id}`);

  if (errorMessage) {
    redirect(`/admin/rechnungen/${id}?fehler=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/admin/rechnungen/${id}?versendet=ok`);
}

export async function erneutVersendenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  let errorMessage: string | null = null;
  try {
    await rechnungErneutVersenden(id);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Erneuter Versand fehlgeschlagen.";
  }

  revalidatePath(`/admin/rechnungen/${id}`);
  if (errorMessage) {
    redirect(`/admin/rechnungen/${id}?fehler=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/admin/rechnungen/${id}?versendet=ok`);
}

export async function loescheEntwurfAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  try {
    await loescheRechnungsentwurf(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Löschen fehlgeschlagen.";
    redirect(`/admin/rechnungen/${id}?fehler=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/rechnungen");
  redirect(`/admin/rechnungen?geloescht=ok`);
}

export async function storniereAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  let stornoId: string | null = null;
  let errorMessage: string | null = null;
  try {
    const res = await storniereRechnung(id);
    stornoId = res.stornoRechnungId;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Stornierung fehlgeschlagen.";
  }

  revalidatePath("/admin/rechnungen");
  revalidatePath(`/admin/rechnungen/${id}`);
  if (errorMessage) {
    redirect(`/admin/rechnungen/${id}?fehler=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/admin/rechnungen/${stornoId}?storniert=ok`);
}

export interface BatchFormState {
  error?: string;
  erstellt?: string[];
  uebersprungen?: { bezeichner: string; grund: string }[];
}

export async function batchEntwuerfeAction(
  _prevState: BatchFormState,
  formData: FormData,
): Promise<BatchFormState> {
  await requireAdmin();

  // Der Sammel-Lauf erzeugt ausschliesslich Jahresabrechnungen - Schluss-
   // rechnungen werden nur einzeln beim Auszug/Mieterwechsel erstellt.
  const typ = "JAHRESABRECHNUNG" as const;
  const vonRaw = String(formData.get("von") ?? "");
  const bisRaw = String(formData.get("bis") ?? "");
  if (!vonRaw || !bisRaw) {
    return { error: "Bitte Zeitraum angeben." };
  }
  const von = new Date(vonRaw);
  const bis = new Date(bisRaw);
  if (von > bis) {
    return { error: "Das Von-Datum muss vor dem Bis-Datum liegen." };
  }

  try {
    const res = await erstelleEntwuerfeFuerAktiveEinheiten({ von, bis, typ });
    revalidatePath("/admin/rechnungen");
    return {
      erstellt: res.erstellt.map((e) => e.bezeichner),
      uebersprungen: res.uebersprungen.map((u) => ({ bezeichner: u.bezeichner, grund: u.grund })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sammel-Erstellung fehlgeschlagen." };
  }
}
