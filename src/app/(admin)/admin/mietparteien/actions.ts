"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { erstelleOderResetZugang } from "@/lib/auth/onboarding";
import { erstelleRechnungsentwurf } from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";

export interface MietparteiFormState {
  error?: string;
  success?: string;
  // Rohwerte zum Wiederbefuellen des Formulars nach einem Validierungsfehler
  // (React 19 setzt unkontrollierte Felder sonst nach der Server-Action zurueck).
  values?: Record<string, string>;
  // Gesetzt, wenn die gewaehlte Einheit bereits eine aktive Mietpartei hat:
  // die UI fragt dann zurueck ("Ist das richtig?") und erhebt das Auszugsdatum
  // des Vormieters, bevor der Umzug bestaetigt wird.
  confirmUmzug?: {
    vorhandenId: string;
    vorhandenBezeichner: string;
    vorschlagAuszug: string;
    auszugBereitsGesetzt: boolean;
  };
}

// Alle rohen Formularwerte fuer die Wiederbefuellung einsammeln.
function collectValues(formData: FormData): Record<string, string> {
  const keys = [
    "einheitId",
    "anrede",
    "name",
    "firma",
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
    "vormieterAuszugsdatum",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

type Anrede = "HERR" | "FRAU" | "FAMILIE" | null;

type ParsedMietpartei = {
  einheitId: string;
  // Name (natuerliche Person / Ansprechpartner). Leerer String erlaubt, wenn
  // firma gesetzt ist (Schema: name String @default("")).
  name: string;
  firma: string | null;
  anrede: Anrede;
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
  const firma = String(formData.get("firma") ?? "").trim();
  const anredeRaw = String(formData.get("anrede") ?? "").trim();
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

  // Name ist Pflicht, ausser wenn eine Firma hinterlegt ist (dann ist der
  // Firmenname der Bezeichner und der Name/Ansprechpartner darf leer sein).
  if (!einheitId || !email || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }
  if (!name && !firma) {
    return { error: "Bitte einen Namen angeben (oder eine Firma hinterlegen)." };
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

  // Anrede nur uebernehmen, wenn gueltig UND ein Name vorhanden ist (bei reinen
  // Firmen ohne Ansprechpartner gibt es keine Anrede - Vorgabe).
  const anrede: Anrede = ["HERR", "FRAU", "FAMILIE"].includes(anredeRaw) && name ? (anredeRaw as Anrede) : null;

  return {
    data: {
      einheitId,
      name,
      firma: firma || null,
      anrede,
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

function tagVor(datum: Date): Date {
  const d = new Date(datum);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function createMietparteiAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const parsed = parseMietparteiInput(formData);
  if ("error" in parsed) return { error: parsed.error, values: collectValues(formData) };

  const bestaetigeUmzug = formData.get("bestaetigeUmzug") === "on";

  // Belegt-Pruefung: existiert auf der Einheit bereits eine (effektiv) aktive
  // Mietpartei, deren Mietverhaeltnis den Einzug des neuen Mieters ueberschneidet?
  const vorhandener = await prisma.mietpartei.findFirst({
    where: {
      einheitId: parsed.data.einheitId,
      status: "AKTIV",
      OR: [{ auszugsdatum: null }, { auszugsdatum: { gte: parsed.data.einzugsdatum } }],
    },
    orderBy: { einzugsdatum: "desc" },
  });

  // Erste Runde: Es gibt einen Vormieter und der Umzug wurde noch nicht
  // bestaetigt -> Rueckfrage + Auszugsdatum erheben.
  if (vorhandener && !bestaetigeUmzug) {
    return {
      values: collectValues(formData),
      confirmUmzug: {
        vorhandenId: vorhandener.id,
        vorhandenBezeichner: mietparteiAnzeigeName(vorhandener),
        vorschlagAuszug: (vorhandener.auszugsdatum ?? tagVor(parsed.data.einzugsdatum)).toISOString().slice(0, 10),
        auszugBereitsGesetzt: vorhandener.auszugsdatum !== null,
      },
    };
  }

  // Optionaler Abschlag direkt beim Anlegen. Standard-Gueltigkeitsbeginn ist
  // das Einzugsdatum (falls im Formular nicht anders gesetzt).
  const abschlagNetto = Number(formData.get("abschlagNetto"));
  const abschlagSteuersatzId = String(formData.get("abschlagSteuersatzId") ?? "");
  const abschlagGueltigAbRaw = String(formData.get("abschlagGueltigAb") ?? "");
  const legeAbschlagAn = Number.isFinite(abschlagNetto) && abschlagNetto > 0 && abschlagSteuersatzId;

  // Bestaetigter Umzug: Auszugsdatum des Vormieters setzen (falls noch offen)
  // und dessen Schlussrechnungs-Entwurf vormerken.
  let vormieterAuszug: Date | null = null;
  if (vorhandener && bestaetigeUmzug) {
    const raw = String(formData.get("vormieterAuszugsdatum") ?? "");
    const datum = raw ? new Date(raw) : vorhandener.auszugsdatum;
    if (!datum || Number.isNaN(datum.getTime())) {
      return { error: "Bitte ein gültiges Auszugsdatum für den Vormieter angeben.", values: collectValues(formData) };
    }
    vormieterAuszug = datum;
  }

  await prisma.$transaction(async (tx) => {
    if (vorhandener && vormieterAuszug) {
      await tx.mietpartei.update({ where: { id: vorhandener.id }, data: { auszugsdatum: vormieterAuszug } });
    }
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

  // Nach dem Anlegen: automatisch einen Schlussrechnungs-Entwurf fuer den
  // Vormieter erzeugen (best-effort - schlaegt es fehl, z.B. weil bereits eine
  // ueberschneidende Rechnung existiert, wird das nur als Hinweis gemeldet).
  if (vorhandener && vormieterAuszug) {
    try {
      const { rechnungId } = await erstelleRechnungsentwurf({
        mietparteiId: vorhandener.id,
        typ: "SCHLUSSRECHNUNG",
        von: vorhandener.einzugsdatum,
        bis: vormieterAuszug,
      });
      await generateAndStoreInvoicePdf(rechnungId).catch(() => {});
      return {
        success: `Neuer Mieter angelegt, Vormieter „${mietparteiAnzeigeName(vorhandener)}" abgemeldet und ein Schlussrechnungs-Entwurf erstellt.`,
      };
    } catch (err) {
      const grund = err instanceof Error ? err.message : "Unbekannter Fehler.";
      return {
        success: `Neuer Mieter angelegt und Vormieter abgemeldet. Hinweis: Schlussrechnungs-Entwurf konnte nicht automatisch erstellt werden (${grund}). Bitte manuell im Bereich Rechnungen anlegen.`,
      };
    }
  }

  return { success: "Mietpartei angelegt." };
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

export interface ZugangState {
  error?: string;
  username?: string;
  password?: string;
  emailFehler?: string;
  wurdeZurueckgesetzt?: boolean;
}

async function zugangAktion(mietparteiId: string, modus: "erstellen" | "zuruecksetzen"): Promise<ZugangState> {
  try {
    const { username, password, emailOk, emailFehler } = await erstelleOderResetZugang(mietparteiId, modus);
    revalidatePath(`/admin/mietparteien/${mietparteiId}`);
    // Zugangsdaten werden einmalig an die Seite zurueckgegeben (Anzeige +
    // Willkommensbrief). Das Passwort wird nicht gespeichert.
    return {
      username,
      password,
      wurdeZurueckgesetzt: modus === "zuruecksetzen",
      emailFehler: emailOk ? undefined : emailFehler,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Aktion konnte nicht ausgeführt werden." };
  }
}

export async function createZugangAction(_prevState: ZugangState, formData: FormData): Promise<ZugangState> {
  await requireAdmin();
  return zugangAktion(String(formData.get("mietparteiId") ?? ""), "erstellen");
}

export async function resetZugangAction(_prevState: ZugangState, formData: FormData): Promise<ZugangState> {
  await requireAdmin();
  return zugangAktion(String(formData.get("mietparteiId") ?? ""), "zuruecksetzen");
}
