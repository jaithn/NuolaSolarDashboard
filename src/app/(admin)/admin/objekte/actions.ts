"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export interface ObjektFormState {
  error?: string;
}

export async function createObjektAction(
  _prevState: ObjektFormState,
  formData: FormData,
): Promise<ObjektFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const plz = String(formData.get("plz") ?? "").trim();
  const ort = String(formData.get("ort") ?? "").trim();
  const { vermieterModus, vermieterName, vermieterName2, vermieterAnschrift, vermieterPlz, vermieterOrt } =
    parseVermieter(formData);
  const bearbeiterName = String(formData.get("bearbeiterName") ?? "").trim() || null;
  const liefertermin = parseDatum(formData.get("geplanterLiefertermin"));
  const hatWaermepumpe = formData.get("hatWaermepumpe") === "on";
  if (!name || !adresse || !plz || !ort) return { error: "Bitte Name, Adresse, PLZ und Ort angeben." };

  await prisma.objekt.create({
    data: {
      name, adresse, plz, ort,
      vermieterModus, vermieterName, vermieterName2, vermieterAnschrift, vermieterPlz, vermieterOrt,
      bearbeiterName, geplanterLiefertermin: liefertermin, hatWaermepumpe,
    },
  });
  revalidatePath("/admin/objekte");
  return {};
}

// Einheiten-Typ aus dem Formular lesen (Fallback WOHNEINHEIT).
function parseEinheitTyp(formData: FormData): "WOHNEINHEIT" | "ALLGEMEINSTROM" | "WAERMEPUMPE" {
  const raw = String(formData.get("typ") ?? "WOHNEINHEIT");
  return raw === "ALLGEMEINSTROM" || raw === "WAERMEPUMPE" ? raw : "WOHNEINHEIT";
}

// Ein Datums-Formularfeld (YYYY-MM-DD) in ein Date wandeln; leer -> null.
function parseDatum(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Vermieter-Angaben eines Objekts aus dem Formular lesen. Bei PRO_EINHEIT wird
// der objektweite Vermieter bewusst geleert (er wird dann je Einheit gepflegt).
function parseVermieter(formData: FormData): {
  vermieterModus: "PRO_OBJEKT" | "PRO_EINHEIT";
  vermieterName: string | null;
  vermieterName2: string | null;
  vermieterAnschrift: string | null;
  vermieterPlz: string;
  vermieterOrt: string;
} {
  const modusRaw = String(formData.get("vermieterModus") ?? "PRO_OBJEKT");
  const vermieterModus = modusRaw === "PRO_EINHEIT" ? "PRO_EINHEIT" : "PRO_OBJEKT";
  if (vermieterModus === "PRO_EINHEIT") {
    return {
      vermieterModus,
      vermieterName: null,
      vermieterName2: null,
      vermieterAnschrift: null,
      vermieterPlz: "",
      vermieterOrt: "",
    };
  }
  const vermieterName = String(formData.get("vermieterName") ?? "").trim();
  const vermieterName2 = String(formData.get("vermieterName2") ?? "").trim();
  const vermieterAnschrift = String(formData.get("vermieterAnschrift") ?? "").trim();
  const vermieterPlz = String(formData.get("vermieterPlz") ?? "").trim();
  const vermieterOrt = String(formData.get("vermieterOrt") ?? "").trim();
  return {
    vermieterModus,
    vermieterName: vermieterName || null,
    vermieterName2: vermieterName2 || null,
    vermieterAnschrift: vermieterAnschrift || null,
    vermieterPlz,
    vermieterOrt,
  };
}

export async function updateObjektAction(
  _prevState: ObjektFormState,
  formData: FormData,
): Promise<ObjektFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const plz = String(formData.get("plz") ?? "").trim();
  const ort = String(formData.get("ort") ?? "").trim();
  const { vermieterModus, vermieterName, vermieterName2, vermieterAnschrift, vermieterPlz, vermieterOrt } =
    parseVermieter(formData);
  const bearbeiterName = String(formData.get("bearbeiterName") ?? "").trim() || null;
  const liefertermin = parseDatum(formData.get("geplanterLiefertermin"));
  const hatWaermepumpe = formData.get("hatWaermepumpe") === "on";
  if (!name || !adresse || !plz || !ort) return { error: "Bitte Name, Adresse, PLZ und Ort angeben." };

  await prisma.objekt.update({
    where: { id },
    data: {
      name, adresse, plz, ort,
      vermieterModus, vermieterName, vermieterName2, vermieterAnschrift, vermieterPlz, vermieterOrt,
      bearbeiterName, geplanterLiefertermin: liefertermin, hatWaermepumpe,
    },
  });
  revalidatePath("/admin/objekte");
  revalidatePath(`/admin/objekte/${id}`);
  return {};
}

export async function deleteObjektAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const [einheitenCount, geraeteCount] = await Promise.all([
    prisma.einheit.count({ where: { objektId: id } }),
    prisma.shellyGeraet.count({ where: { objektId: id } }),
  ]);

  if (einheitenCount > 0 || geraeteCount > 0) {
    redirect(`/admin/objekte?fehler=${encodeURIComponent("Objekt enthält noch Einheiten oder Geräte und kann nicht gelöscht werden.")}`);
  }

  await prisma.objekt.delete({ where: { id } });
  revalidatePath("/admin/objekte");
  redirect("/admin/objekte");
}

export async function createEinheitAction(
  _prevState: ObjektFormState,
  formData: FormData,
): Promise<ObjektFormState> {
  await requireAdmin();

  const objektId = String(formData.get("objektId") ?? "");
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const typ = parseEinheitTyp(formData);
  // Vermieter-Angaben nur bei echten Wohneinheiten (Ergaenzung zum Mietvertrag).
  const istWohnung = typ === "WOHNEINHEIT";
  const vermieterName = istWohnung ? String(formData.get("vermieterName") ?? "").trim() : "";
  const vermieterName2 = istWohnung ? String(formData.get("vermieterName2") ?? "").trim() : "";
  const vermieterAnschrift = istWohnung ? String(formData.get("vermieterAnschrift") ?? "").trim() : "";
  const vermieterPlz = istWohnung ? String(formData.get("vermieterPlz") ?? "").trim() : "";
  const vermieterOrt = istWohnung ? String(formData.get("vermieterOrt") ?? "").trim() : "";
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };

  if (!objektId) return { error: "Bitte ein Objekt wählen." };
  await prisma.einheit.create({
    data: {
      objektId, bezeichnung, typ,
      vermieterName: vermieterName || null, vermieterName2: vermieterName2 || null,
      vermieterAnschrift: vermieterAnschrift || null,
      vermieterPlz, vermieterOrt,
    },
  });
  revalidatePath(`/admin/objekte/${objektId}`);
  revalidatePath("/admin/objekte");
  return {};
}

export async function updateEinheitAction(
  _prevState: ObjektFormState,
  formData: FormData,
): Promise<ObjektFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const typ = parseEinheitTyp(formData);
  const istWohnung = typ === "WOHNEINHEIT";
  const vermieterName = istWohnung ? String(formData.get("vermieterName") ?? "").trim() : "";
  const vermieterName2 = istWohnung ? String(formData.get("vermieterName2") ?? "").trim() : "";
  const vermieterAnschrift = istWohnung ? String(formData.get("vermieterAnschrift") ?? "").trim() : "";
  const vermieterPlz = istWohnung ? String(formData.get("vermieterPlz") ?? "").trim() : "";
  const vermieterOrt = istWohnung ? String(formData.get("vermieterOrt") ?? "").trim() : "";
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };

  const einheit = await prisma.einheit.update({
    where: { id },
    data: {
      bezeichnung, typ,
      vermieterName: vermieterName || null, vermieterName2: vermieterName2 || null,
      vermieterAnschrift: vermieterAnschrift || null,
      vermieterPlz, vermieterOrt,
    },
  });
  revalidatePath(`/admin/einheiten/${id}`);
  revalidatePath(`/admin/objekte/${einheit.objektId}`);
  revalidatePath("/admin/objekte");
  return {};
}

export async function deleteEinheitAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const objektId = String(formData.get("objektId") ?? "");

  const [mietparteienCount, zuordnungenCount] = await Promise.all([
    prisma.mietpartei.count({ where: { einheitId: id } }),
    prisma.geraetZuordnung.count({ where: { einheitId: id } }),
  ]);

  if (mietparteienCount > 0 || zuordnungenCount > 0) {
    redirect(
      `/admin/objekte/${objektId}?fehler=${encodeURIComponent("Einheit enthält noch Mietparteien oder Geräte-Zuordnungen und kann nicht gelöscht werden.")}`,
    );
  }

  await prisma.einheit.delete({ where: { id } });
  revalidatePath(`/admin/objekte/${objektId}`);
  redirect(`/admin/objekte/${objektId}`);
}
