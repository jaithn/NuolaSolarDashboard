"use server";

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
  const name = String(formData.get("name") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  if (!name || !adresse) return { error: "Bitte Name und Adresse angeben." };

  await prisma.objekt.create({ data: { name, adresse } });
  revalidatePath("/admin/objekte");
  return {};
}

export async function updateObjektAction(
  _prevState: ObjektFormState,
  formData: FormData,
): Promise<ObjektFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  if (!name || !adresse) return { error: "Bitte Name und Adresse angeben." };

  await prisma.objekt.update({ where: { id }, data: { name, adresse } });
  revalidatePath("/admin/objekte");
  revalidatePath(`/admin/objekte/${id}`);
  return {};
}

export async function deleteObjektAction(formData: FormData): Promise<void> {
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
  const objektId = String(formData.get("objektId") ?? "");
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };

  await prisma.einheit.create({ data: { objektId, bezeichnung } });
  revalidatePath(`/admin/objekte/${objektId}`);
  return {};
}

export async function deleteEinheitAction(formData: FormData): Promise<void> {
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
