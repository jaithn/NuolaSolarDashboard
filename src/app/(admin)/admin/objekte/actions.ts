"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { istVermietbareEinheit, type EinheitTyp } from "./einheitTyp";
import type { Anrede } from "@prisma/client";

export interface ObjektFormState {
  error?: string;
  // Wechselt bei jedem erfolgreichen Speichern (Edit). Fliesst in den Form-key
  // ein, damit kontrollierte Felder (z.B. das Typ-<select>) nach dem
  // React-19-Formular-Reset neu gemountet und mit dem gespeicherten Wert befuellt
  // werden - sonst springt die Anzeige auf den ersten Options-Wert zurueck.
  savedNonce?: string;
}

// Anrede-Formularwert lesen (fuer Vermieter:in). Leer/ungueltig -> null.
function parseAnrede(value: FormDataEntryValue | null): Anrede | null {
  const raw = String(value ?? "").trim();
  return raw === "HERR" || raw === "FRAU" || raw === "FAMILIE" || raw === "FIRMA" ? (raw as Anrede) : null;
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
  const vermieter = parseVermieter(formData);
  const zusatz = parseObjektZusatz(formData);
  const grundversorger = parseGrundversorger(formData);
  const bearbeiterName = String(formData.get("bearbeiterName") ?? "").trim() || null;
  const liefertermin = parseDatum(formData.get("geplanterLiefertermin"));
  const hatWaermepumpe = formData.get("hatWaermepumpe") === "on";
  if (!name || !adresse || !plz || !ort) return { error: "Bitte Name, Adresse, PLZ und Ort angeben." };

  await prisma.objekt.create({
    data: {
      name, adresse, plz, ort,
      ...vermieter,
      ...zusatz,
      ...grundversorger,
      bearbeiterName, geplanterLiefertermin: liefertermin, hatWaermepumpe,
    },
  });
  revalidatePath("/admin/objekte");
  return {};
}

// Einheiten-Typ aus dem Formular lesen (Fallback WOHNEINHEIT).
function parseEinheitTyp(formData: FormData): EinheitTyp {
  const raw = String(formData.get("typ") ?? "WOHNEINHEIT");
  return raw === "GEWERBEEINHEIT" || raw === "ALLGEMEINSTROM" || raw === "WAERMEPUMPE" ? raw : "WOHNEINHEIT";
}

// Objekt-Zusatzfelder (oeffentlicher Zaehler, Hausverwaltung, Unterzeichner der
// Ergaenzung) aus dem Formular lesen.
function parseObjektZusatz(formData: FormData) {
  const oeffentlicherZaehler = String(formData.get("oeffentlicherZaehler") ?? "").trim() || null;
  const hausverwaltungName = String(formData.get("hausverwaltungName") ?? "").trim() || null;
  const hausverwaltungAnschrift = String(formData.get("hausverwaltungAnschrift") ?? "").trim() || null;
  const hausverwaltungPlz = String(formData.get("hausverwaltungPlz") ?? "").trim();
  const hausverwaltungOrt = String(formData.get("hausverwaltungOrt") ?? "").trim();
  const hausverwaltungAnsprechperson = String(formData.get("hausverwaltungAnsprechperson") ?? "").trim() || null;
  const hausverwaltungTelefon = String(formData.get("hausverwaltungTelefon") ?? "").trim() || null;
  const hausverwaltungEmail = String(formData.get("hausverwaltungEmail") ?? "").trim() || null;
  const unterzeichnerRaw = String(formData.get("ergaenzungUnterzeichner") ?? "VERMIETER");
  // Hausverwaltung nur als Unterzeichner zulassen, wenn ein Name hinterlegt ist.
  const ergaenzungUnterzeichner =
    unterzeichnerRaw === "HAUSVERWALTUNG" && hausverwaltungName ? "HAUSVERWALTUNG" : "VERMIETER";
  return {
    oeffentlicherZaehler,
    hausverwaltungName,
    hausverwaltungAnschrift,
    hausverwaltungPlz,
    hausverwaltungOrt,
    hausverwaltungAnsprechperson,
    hausverwaltungTelefon,
    hausverwaltungEmail,
    ergaenzungUnterzeichner: ergaenzungUnterzeichner as "VERMIETER" | "HAUSVERWALTUNG",
  };
}

// Grundversorger-Vergleich (je Objekt) aus dem Formular lesen. Preise brutto;
// leere Zahlenfelder -> null. grundversorgerStand als Date (oder null).
function parseGrundversorger(formData: FormData) {
  const zahl = (v: FormDataEntryValue | null): number | null => {
    const raw = String(v ?? "").trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    grundversorgerName: String(formData.get("grundversorgerName") ?? "").trim() || null,
    grundversorgerTarif: String(formData.get("grundversorgerTarif") ?? "").trim() || null,
    grundversorgerGrundpreisBrutto: zahl(formData.get("grundversorgerGrundpreisBrutto")),
    grundversorgerArbeitspreisBrutto: zahl(formData.get("grundversorgerArbeitspreisBrutto")),
    grundversorgerStand: parseDatum(formData.get("grundversorgerStand")),
  };
}

// Ein Datums-Formularfeld (YYYY-MM-DD) in ein Date wandeln; leer -> null.
function parseDatum(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Vermieter-Angaben einer Einheit (nur bei vermietbaren Einheiten -
// Wohn-/Gewerbeeinheit; Sonder-Einheiten haben keine eigene Vermieter:in).
function parseEinheitVermieter(formData: FormData, typ: EinheitTyp) {
  const aktiv = istVermietbareEinheit(typ);
  return {
    vermieterName: aktiv ? String(formData.get("vermieterName") ?? "").trim() || null : null,
    vermieterName2: aktiv ? String(formData.get("vermieterName2") ?? "").trim() || null : null,
    vermieterAnrede: aktiv ? parseAnrede(formData.get("vermieterAnrede")) : null,
    vermieterAnrede2: aktiv ? parseAnrede(formData.get("vermieterAnrede2")) : null,
    vermieterFirma: aktiv ? String(formData.get("vermieterFirma") ?? "").trim() || null : null,
    vermieterAnschrift: aktiv ? String(formData.get("vermieterAnschrift") ?? "").trim() || null : null,
    vermieterPlz: aktiv ? String(formData.get("vermieterPlz") ?? "").trim() : "",
    vermieterOrt: aktiv ? String(formData.get("vermieterOrt") ?? "").trim() : "",
  };
}

// Vermieter-Angaben eines Objekts aus dem Formular lesen. Bei PRO_EINHEIT wird
// der objektweite Vermieter bewusst geleert (er wird dann je Einheit gepflegt).
function parseVermieter(formData: FormData): {
  vermieterModus: "PRO_OBJEKT" | "PRO_EINHEIT";
  vermieterName: string | null;
  vermieterName2: string | null;
  vermieterAnrede: Anrede | null;
  vermieterAnrede2: Anrede | null;
  vermieterFirma: string | null;
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
      vermieterAnrede: null,
      vermieterAnrede2: null,
      vermieterFirma: null,
      vermieterAnschrift: null,
      vermieterPlz: "",
      vermieterOrt: "",
    };
  }
  const vermieterName = String(formData.get("vermieterName") ?? "").trim();
  const vermieterName2 = String(formData.get("vermieterName2") ?? "").trim();
  const vermieterFirma = String(formData.get("vermieterFirma") ?? "").trim();
  const vermieterAnschrift = String(formData.get("vermieterAnschrift") ?? "").trim();
  const vermieterPlz = String(formData.get("vermieterPlz") ?? "").trim();
  const vermieterOrt = String(formData.get("vermieterOrt") ?? "").trim();
  return {
    vermieterModus,
    vermieterName: vermieterName || null,
    vermieterName2: vermieterName2 || null,
    vermieterAnrede: parseAnrede(formData.get("vermieterAnrede")),
    vermieterAnrede2: parseAnrede(formData.get("vermieterAnrede2")),
    vermieterFirma: vermieterFirma || null,
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
  const vermieter = parseVermieter(formData);
  const zusatz = parseObjektZusatz(formData);
  const grundversorger = parseGrundversorger(formData);
  const bearbeiterName = String(formData.get("bearbeiterName") ?? "").trim() || null;
  const liefertermin = parseDatum(formData.get("geplanterLiefertermin"));
  const hatWaermepumpe = formData.get("hatWaermepumpe") === "on";
  if (!name || !adresse || !plz || !ort) return { error: "Bitte Name, Adresse, PLZ und Ort angeben." };

  await prisma.objekt.update({
    where: { id },
    data: {
      name, adresse, plz, ort,
      ...vermieter,
      ...zusatz,
      ...grundversorger,
      bearbeiterName, geplanterLiefertermin: liefertermin, hatWaermepumpe,
    },
  });
  revalidatePath("/admin/objekte");
  revalidatePath(`/admin/objekte/${id}`);
  // savedNonce erzwingt im Edit-Formular einen Remount, damit alle <select>-Felder
  // (Vermieter-Modus/-Anrede, Unterzeichner) nach dem React-19-Formular-Reset den
  // gespeicherten Wert anzeigen statt auf den ersten Options-Wert zurueckzuspringen.
  return { savedNonce: Date.now().toString() };
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
  const vermieter = parseEinheitVermieter(formData, typ);
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };

  if (!objektId) return { error: "Bitte ein Objekt wählen." };
  await prisma.einheit.create({
    data: {
      objektId, bezeichnung, typ,
      ...vermieter,
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
  const vermieter = parseEinheitVermieter(formData, typ);
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };

  const einheit = await prisma.einheit.update({
    where: { id },
    data: {
      bezeichnung, typ,
      ...vermieter,
    },
  });
  revalidatePath(`/admin/einheiten/${id}`);
  revalidatePath(`/admin/objekte/${einheit.objektId}`);
  revalidatePath("/admin/objekte");
  return { savedNonce: Date.now().toString() };
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
