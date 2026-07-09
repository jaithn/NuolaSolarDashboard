"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { erstelleRechnungsentwurf } from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { freigebenUndVersenden } from "@/lib/billing/releaseInvoice";

export interface RechnungFormState {
  error?: string;
}

export async function createRechnungsentwurfAction(
  _prevState: RechnungFormState,
  formData: FormData,
): Promise<RechnungFormState> {
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
    return { error: err instanceof Error ? err.message : "Rechnung konnte nicht erstellt werden." };
  }

  revalidatePath("/admin/rechnungen");
  redirect(`/admin/rechnungen/${rechnungId}`);
}

export async function freigebenAction(formData: FormData): Promise<void> {
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
