"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  erstelleRechnungsentwurf,
  erstelleEntwuerfeFuerAktiveEinheiten,
  UeberschneidendeRechnungError,
} from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { freigebenUndVersenden, rechnungErneutVersenden } from "@/lib/billing/releaseInvoice";
import { storniereRechnung } from "@/lib/billing/storno";
import { loescheRechnungsentwurf } from "@/lib/billing/deleteDraft";

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

  const typ = String(formData.get("typ") ?? "JAHRESABRECHNUNG") as "JAHRESABRECHNUNG" | "SCHLUSSRECHNUNG";
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
