"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { erstelleOderResetZugang } from "@/lib/auth/onboarding";
import { erstelleRechnungsentwurf } from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";
import { speichereDokument, loescheDokument } from "@/lib/dokumente";
import { vergibKundennummerFallsNoetig } from "@/lib/kundennummer";
import type { DokumentTyp, VertragArt } from "@prisma/client";

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
    "vorname",
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
    "grundversorgerName",
    "grundversorgerTarif",
    "grundversorgerGrundpreisBrutto",
    "grundversorgerArbeitspreisBrutto",
    "vertragsart",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

type Anrede = "HERR" | "FRAU" | "FAMILIE" | "FIRMA" | null;

type ParsedMietpartei = {
  einheitId: string;
  // Vorname (natuerliche Person). Leer bei Firmen.
  vorname: string;
  // Nachname (natuerliche Person). Leerer String erlaubt, wenn firma gesetzt ist
  // (Schema: name String @default("")).
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
  status: "INTERESSENT" | "AKTIV" | "INAKTIV";
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  // Grundversorger-Vergleich (Onboarding-Anschreiben), Preise brutto.
  grundversorgerName: string | null;
  grundversorgerTarif: string | null;
  grundversorgerGrundpreisBrutto: number | null;
  grundversorgerArbeitspreisBrutto: number | null;
  vertragsart: VertragArt | null;
};

function parseMietparteiInput(formData: FormData): { error: string } | { data: ParsedMietpartei } {
  const einheitId = String(formData.get("einheitId") ?? "");
  const vorname = String(formData.get("vorname") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const firma = String(formData.get("firma") ?? "").trim();
  const anredeRaw = String(formData.get("anrede") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const einzugsdatumRaw = String(formData.get("einzugsdatum") ?? "");
  const auszugsdatumRaw = String(formData.get("auszugsdatum") ?? "");
  const statusRaw = String(formData.get("status") ?? "AKTIV");
  const status = (["INTERESSENT", "AKTIV", "INAKTIV"].includes(statusRaw) ? statusRaw : "AKTIV") as
    | "INTERESSENT"
    | "AKTIV"
    | "INAKTIV";
  const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
  const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
  const hatGrundpreis = formData.get("hatGrundpreis") === "on";
  const grundpreisNetto = Number(formData.get("grundpreisNetto"));
  const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");

  // Grundversorger-Vergleich (optional, nur fuer das Anschreiben). Preise brutto.
  const grundversorgerName = String(formData.get("grundversorgerName") ?? "").trim();
  const grundversorgerTarif = String(formData.get("grundversorgerTarif") ?? "").trim();
  const gvGrund = Number(formData.get("grundversorgerGrundpreisBrutto"));
  const gvArbeit = Number(formData.get("grundversorgerArbeitspreisBrutto"));
  const vertragsartRaw = String(formData.get("vertragsart") ?? "");
  const vertragsart = (["EIGENSTAENDIG", "ERGAENZUNG"].includes(vertragsartRaw)
    ? vertragsartRaw
    : null) as VertragArt | null;

  if (!einheitId || !email || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  // Anrede uebernehmen, sobald ein gueltiger Wert gewaehlt wurde. Die Anrede ist
  // zugleich Diskriminator: FIRMA -> juristische Person (Firmenname Pflicht,
  // Name/Vorname bleiben leer); HERR/FRAU/FAMILIE/keine -> natuerliche Person
  // (Nachname Pflicht, keine Firma).
  const anrede: Anrede = ["HERR", "FRAU", "FAMILIE", "FIRMA"].includes(anredeRaw) ? (anredeRaw as Anrede) : null;
  const istFirma = anrede === "FIRMA";
  if (istFirma) {
    if (!firma) return { error: "Bitte den Firmennamen angeben." };
  } else if (!name) {
    return { error: "Bitte den Namen angeben." };
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
      // Konsistenz erzwingen: Firmen haben keinen Vor-/Nachnamen, Personen keine Firma.
      vorname: istFirma ? "" : vorname,
      name: istFirma ? "" : name,
      firma: istFirma ? firma : null,
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
      grundversorgerName: grundversorgerName || null,
      grundversorgerTarif: grundversorgerTarif || null,
      grundversorgerGrundpreisBrutto: Number.isFinite(gvGrund) && gvGrund > 0 ? gvGrund : null,
      grundversorgerArbeitspreisBrutto: Number.isFinite(gvArbeit) && gvArbeit > 0 ? gvArbeit : null,
      vertragsart,
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
      return { error: "Bitte ein gültiges Auszugsdatum für die bisherige Mietpartei angeben.", values: collectValues(formData) };
    }
    vormieterAuszug = datum;
  }

  const neueMietparteiId = await prisma.$transaction(async (tx) => {
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
    return mietpartei.id;
  });

  // Direkt als AKTIV angelegt -> sofort Kundennummer vergeben (analog Aktivstellen).
  if (parsed.data.status === "AKTIV") {
    await vergibKundennummerFallsNoetig(neueMietparteiId);
  }

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
        success: `Neue Mietpartei angelegt, bisherige Mietpartei „${mietparteiAnzeigeName(vorhandener)}" abgemeldet und ein Schlussrechnungs-Entwurf erstellt.`,
      };
    } catch (err) {
      const grund = err instanceof Error ? err.message : "Unbekannter Fehler.";
      return {
        success: `Neue Mietpartei angelegt und bisherige Mietpartei abgemeldet. Hinweis: Schlussrechnungs-Entwurf konnte nicht automatisch erstellt werden (${grund}). Bitte manuell im Bereich Rechnungen anlegen.`,
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
  // Der neue Abschlag loest den bisherigen ab: jeder vor dem neuen beginnende
  // Abschlag, der sonst mit ihm ueberschneiden wuerde (offenes Ende ODER Ende
  // am/nach dem neuen Beginn), wird am Tag VOR dem neuen Gueltigkeitsbeginn
  // beendet - so entsteht keine Ueberschneidung/Doppelberechnung und der
  // Vorgaenger hat immer ein sauberes Enddatum.
  const tagVorNeu = new Date(gueltigAb);
  tagVorNeu.setDate(tagVorNeu.getDate() - 1);

  await prisma.$transaction(async (tx) => {
    await tx.abschlag.updateMany({
      where: {
        mietparteiId,
        gueltigAb: { lt: gueltigAb },
        OR: [{ gueltigBis: null }, { gueltigBis: { gte: gueltigAb } }],
      },
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

// ---------------------------------------------------------------------------
// Onboarding: Statuswechsel + gescannte Dokumente
// ---------------------------------------------------------------------------

export interface OnboardingState {
  error?: string;
  success?: string;
}

/**
 * Überführt eine Mietpartei in einen neuen Status (typischerweise
 * INTERESSENT → AKTIV/INAKTIV). Scans sind bewusst NICHT verpflichtend; fehlen
 * bei der Aktivierung Vertrag oder SEPA-Mandat, wird nur ein Hinweis ergänzt.
 */
export async function setMietparteiStatusAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const zielStatus = String(formData.get("status") ?? "");
  if (!["INTERESSENT", "AKTIV", "INAKTIV"].includes(zielStatus)) {
    return { error: "Ungültiger Zielstatus." };
  }

  const mietpartei = await prisma.mietpartei.findUnique({
    where: { id: mietparteiId },
    include: { dokumente: true },
  });
  if (!mietpartei) return { error: "Mietpartei nicht gefunden." };

  await prisma.mietpartei.update({
    where: { id: mietparteiId },
    data: { status: zielStatus as "INTERESSENT" | "AKTIV" | "INAKTIV" },
  });
  // Beim Aktivstellen eine Kundennummer vergeben (falls noch keine vorhanden) -
  // sie ist zugleich Basis der SEPA-Mandatsreferenz.
  if (zielStatus === "AKTIV") {
    await vergibKundennummerFallsNoetig(mietparteiId);
  }
  revalidatePath("/admin/mietparteien");
  revalidatePath(`/admin/mietparteien/${mietparteiId}`);

  const statusLabel = zielStatus === "AKTIV" ? "aktiv" : zielStatus === "INAKTIV" ? "inaktiv" : "Interessent:in";
  // Bei Aktivierung auf fehlende Scan-Rückläufer hinweisen (nicht blockierend).
  if (zielStatus === "AKTIV") {
    const hatVertrag = mietpartei.dokumente.some((d) => d.typ === "VERTRAG");
    const hatSepa = mietpartei.dokumente.some((d) => d.typ === "SEPA");
    const fehlend = [!hatVertrag ? "unterschriebener Vertrag" : null, !hatSepa ? "SEPA-Mandat" : null].filter(
      Boolean,
    );
    if (fehlend.length > 0) {
      return {
        success: `Status auf „${statusLabel}" gesetzt. Hinweis: Es fehlt noch ein Scan (${fehlend.join(
          " und ",
        )}). Bitte bei Vorliegen nachreichen.`,
      };
    }
  }
  return { success: `Status auf „${statusLabel}" gesetzt.` };
}

const DOKUMENT_TYPEN: DokumentTyp[] = ["VERTRAG", "SEPA", "ANSCHREIBEN", "SONSTIGES"];

/** Nimmt eine hochgeladene, gescannte Datei entgegen und legt sie dauerhaft ab. */
export async function uploadDokumentAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const typRaw = String(formData.get("typ") ?? "");
  const typ = (DOKUMENT_TYPEN.includes(typRaw as DokumentTyp) ? typRaw : "SONSTIGES") as DokumentTyp;
  const datei = formData.get("datei");

  if (!mietparteiId) return { error: "Mietpartei fehlt." };
  if (!(datei instanceof File) || datei.size === 0) return { error: "Bitte eine Datei auswählen." };

  const mietpartei = await prisma.mietpartei.findUnique({ where: { id: mietparteiId } });
  if (!mietpartei) return { error: "Mietpartei nicht gefunden." };

  try {
    const bytes = Buffer.from(await datei.arrayBuffer());
    await speichereDokument({ mietparteiId, typ, originalName: datei.name, bytes });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Datei konnte nicht gespeichert werden." };
  }

  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return { success: "Dokument hochgeladen." };
}

/**
 * Dokumentiert, welche Vertragsversion eine Mietpartei unterschrieben hat. Diese
 * bleibt fuer die Mietpartei gueltig, auch wenn spaeter eine neuere Version aktiv
 * wird. Leerer Wert entfernt die Zuordnung (PDF nutzt dann die aktive Version).
 */
export async function setSignierteVersionAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const versionId = String(formData.get("vertragVersionId") ?? "").trim();
  if (!mietparteiId) return { error: "Mietpartei fehlt." };

  const wert = versionId || null;
  if (wert) {
    const version = await prisma.vertragVersion.findUnique({ where: { id: wert } });
    if (!version) return { error: "Vertragsversion nicht gefunden." };
  }

  await prisma.mietpartei.update({ where: { id: mietparteiId }, data: { vertragVersionId: wert } });
  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return { success: wert ? "Unterschriebene Vertragsversion dokumentiert." : "Zuordnung entfernt." };
}

/** Löscht ein hinterlegtes Dokument (Datei + Datensatz). */
export async function deleteDokumentAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const dokumentId = String(formData.get("dokumentId") ?? "");
  if (!dokumentId) return { error: "Dokument fehlt." };

  const dok = await prisma.mietparteiDokument.findUnique({ where: { id: dokumentId } });
  if (!dok || dok.mietparteiId !== mietparteiId) return { error: "Dokument nicht gefunden." };

  await loescheDokument(dokumentId);
  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return { success: "Dokument gelöscht." };
}
