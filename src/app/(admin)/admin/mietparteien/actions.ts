"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { erstelleOderResetZugang } from "@/lib/auth/onboarding";
import { erstelleRechnungsentwurf } from "@/lib/billing/generateInvoice";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/renderInvoicePdf";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";
import { speichereDokument, loescheDokument } from "@/lib/dokumente";
import { vergibKundennummerFallsNoetig } from "@/lib/kundennummer";
import { berechneNettoAusBrutto } from "@/lib/steuer";
import { normalisiereIban, istGueltigeIban, bankAusIban } from "@/lib/bank/iban";
import type { DokumentTyp } from "@prisma/client";

export interface MietparteiFormState {
  error?: string;
  success?: string;
  // Rohwerte zum Wiederbefuellen des Formulars nach einem Validierungsfehler
  // (React 19 setzt unkontrollierte Felder sonst nach der Server-Action zurueck).
  values?: Record<string, string>;
  // Wechselt bei jedem erfolgreichen Speichern (Edit). Fliesst in den Form-key
  // ein, damit die kontrollierten Felder (u.a. das Anrede-<select>) nach dem
  // automatischen Formular-Reset von React 19 neu gemountet und mit dem
  // aktuellen Wert befuellt werden - sonst zeigt das <select> faelschlich wieder
  // "- keine -", obwohl der Wert korrekt gespeichert wurde.
  savedNonce?: string;
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
    "weiterePersonen",
    "firma",
    "email",
    "telefon",
    "kontoinhaber",
    "iban",
    "bankName",
    "anschrift",
    "anschriftPlz",
    "anschriftOrt",
    "einzugsdatum",
    "auszugsdatum",
    "status",
    "arbeitspreisNetto",
    "arbeitspreisSteuersatzId",
    "hatGrundpreis",
    "grundpreisNetto",
    "grundpreisSteuersatzId",
    "abschlagBrutto",
    "abschlagSteuersatzId",
    "abschlagGueltigAb",
    "vormieterAuszugsdatum",
    "angenommenerJahresverbrauchKwh",
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
  // Weitere Personen (ab Person 2), beliebig viele. Leeres Array -> nur eine Person.
  // anrede als String ("" = keine), damit das JSON-Feld kein null enthaelt.
  weiterePersonen: { anrede: string; vorname: string; name: string }[];
  // Legacy-Einzelfelder der zweiten Person: werden beim Speichern nur noch geleert.
  vorname2: string;
  name2: string;
  anrede2: Anrede;
  firma: string | null;
  anrede: Anrede;
  email: string;
  telefon: string | null;
  // Bankverbindung (SEPA). iban normalisiert; bankName/bicOderBlz aus der IBAN
  // abgeleitet (Fallback: manuell eingegebener Bankname).
  kontoinhaber: string;
  iban: string | null;
  bankName: string | null;
  bicOderBlz: string | null;
  // Postanschrift (Strasse) der Mietpartei; leer -> Objektadresse. PLZ/Ort separat.
  anschrift: string | null;
  anschriftPlz: string;
  anschriftOrt: string;
  einzugsdatum: Date;
  auszugsdatum: Date | null;
  status: "INTERESSENT" | "AKTIV" | "INAKTIV";
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  angenommenerJahresverbrauchKwh: number | null;
};

// Weitere Personen (ab Person 2) aus dem versteckten JSON-Formularfeld lesen und
// robust validieren: nur Personen mit mindestens Vor- ODER Nachname; Anrede auf
// natuerliche Personen beschraenkt (nie FIRMA).
function parseWeiterePersonenForm(raw: FormDataEntryValue | null): { anrede: string; vorname: string; name: string }[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const anredeRaw = String(o.anrede ?? "").trim();
      // Anrede als String speichern ("" = keine) - vermeidet null im JSON-Feld.
      const anrede = ["HERR", "FRAU", "FAMILIE"].includes(anredeRaw) ? anredeRaw : "";
      return { anrede, vorname: String(o.vorname ?? "").trim(), name: String(o.name ?? "").trim() };
    })
    .filter((p) => p.vorname || p.name);
}

function parseMietparteiInput(formData: FormData): { error: string } | { data: ParsedMietpartei } {
  const einheitId = String(formData.get("einheitId") ?? "");
  const vorname = String(formData.get("vorname") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  // Weitere Personen (ab Person 2) kommen als JSON-Array aus dem Formular.
  const weiterePersonen = parseWeiterePersonenForm(formData.get("weiterePersonen"));
  const firma = String(formData.get("firma") ?? "").trim();
  const anredeRaw = String(formData.get("anrede") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const kontoinhaber = String(formData.get("kontoinhaber") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();
  const bankNameManuell = String(formData.get("bankName") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const anschriftPlz = String(formData.get("anschriftPlz") ?? "").trim();
  const anschriftOrt = String(formData.get("anschriftOrt") ?? "").trim();
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

  // Grundversorger-Vergleich wird jetzt am OBJEKT gepflegt (nicht mehr je
  // Mietpartei) - siehe Objekt-Formular / GrundversorgerFelder.
  const angenommenerVerbrauch = Number(formData.get("angenommenerJahresverbrauchKwh"));

  // E-Mail ist bewusst optional: Interessent:innen liegen anfangs oft ohne
  // E-Mail vor. Fuer Login/Zugang und Mailversand ist spaeter eine gueltige
  // Adresse noetig (dort wird das separat geprueft).
  if (!einheitId || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  // Anrede uebernehmen, sobald ein gueltiger Wert gewaehlt wurde. Die Anrede ist
  // zugleich Diskriminator: FIRMA -> juristische Person (Firmenname Pflicht,
  // Name/Vorname bleiben leer); HERR/FRAU/FAMILIE/keine -> natuerliche Person
  // (Nachname Pflicht, keine Firma).
  const anrede: Anrede = ["HERR", "FRAU", "FAMILIE", "FIRMA"].includes(anredeRaw) ? (anredeRaw as Anrede) : null;
  const istFirma = anrede === "FIRMA";
  // Weitere Personen nur bei natuerlichen Personen; bei Firma verworfen.
  const weiterePersonenEffektiv = istFirma ? [] : weiterePersonen;
  if (istFirma) {
    if (!firma) return { error: "Bitte den Firmennamen angeben." };
  } else if (!name) {
    return { error: "Bitte den Namen angeben." };
  }

  // Strikte E-Mail-Validierung NUR wenn eine Adresse angegeben wurde (optional):
  // verhindert u.a. Zeilenumbrueche/Sonderzeichen in der Empfaengeradresse
  // (SMTP-Header-Injection) bei Onboarding- und Rechnungsmails.
  if (email && !z.string().email().max(254).safeParse(email).success) {
    return { error: "Die E-Mail-Adresse ist ungültig." };
  }
  if (!Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
    return { error: "Der Arbeitspreis ist ungültig." };
  }

  // IBAN optional; wenn angegeben, normalisieren + Pruefsumme pruefen und Bank
  // ableiten (Fallback: manuell eingegebener Bankname).
  const iban = ibanRaw ? normalisiereIban(ibanRaw) : "";
  if (iban && !istGueltigeIban(iban)) {
    return { error: "Die IBAN ist ungültig." };
  }
  const bankInfo = iban ? bankAusIban(iban) : null;

  return {
    data: {
      einheitId,
      // Bei Firmen ist ein Ansprechpartner-Name optional erlaubt (wird gespeichert,
      // aber im Brief wird weiterhin die Firma angeschrieben). Personen haben keine Firma.
      vorname,
      name,
      // Weitere Personen (ab Person 2) als JSON-Array. Legacy-Einzelfelder werden
      // beim Speichern geleert, damit sie nicht mit weiterePersonen kollidieren
      // (sonst taeuchte eine geloeschte zweite Person ueber den Legacy-Fallback wieder auf).
      weiterePersonen: weiterePersonenEffektiv,
      vorname2: "",
      name2: "",
      anrede2: null,
      firma: istFirma ? firma : null,
      anrede,
      email,
      telefon: telefon || null,
      kontoinhaber,
      iban: iban || null,
      bankName: bankInfo?.bankName || bankNameManuell || null,
      bicOderBlz: bankInfo?.bic || null,
      anschrift: anschrift || null,
      anschriftPlz,
      anschriftOrt,
      einzugsdatum: new Date(einzugsdatumRaw),
      auszugsdatum: auszugsdatumRaw ? new Date(auszugsdatumRaw) : null,
      status,
      // Anschreiben-Variante + Ergaenzungs-Bedarf werden NICHT hier gesetzt,
      // sondern ausschliesslich unten bei den Vertragsunterlagen (OnboardingPanel,
      // setOnboardingOptionenAction) - beim Anlegen greifen die Schema-Defaults
      // (formal / Ergaenzung erforderlich).
      arbeitspreisNetto,
      arbeitspreisSteuersatzId,
      grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
      grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
      angenommenerJahresverbrauchKwh:
        Number.isFinite(angenommenerVerbrauch) && angenommenerVerbrauch > 0 ? angenommenerVerbrauch : null,
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

  // Optionaler Abschlag direkt beim Anlegen. Der Betrag wird BRUTTO (inkl. MwSt.)
  // erfasst; das Netto leiten wir daraus ab. Standard-Gueltigkeitsbeginn ist das
  // Einzugsdatum (falls im Formular nicht anders gesetzt).
  const abschlagBrutto = Number(formData.get("abschlagBrutto"));
  const abschlagSteuersatzId = String(formData.get("abschlagSteuersatzId") ?? "");
  const abschlagGueltigAbRaw = String(formData.get("abschlagGueltigAb") ?? "");
  const legeAbschlagAn = Number.isFinite(abschlagBrutto) && abschlagBrutto > 0 && Boolean(abschlagSteuersatzId);
  const abschlagSatz = legeAbschlagAn
    ? await prisma.steuersatz.findUnique({ where: { id: abschlagSteuersatzId } })
    : null;

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
    if (legeAbschlagAn && abschlagSatz) {
      await tx.abschlag.create({
        data: {
          mietparteiId: mietpartei.id,
          bruttoBetrag: abschlagBrutto,
          nettoBetrag: berechneNettoAusBrutto(abschlagBrutto, abschlagSatz.prozentsatz),
          steuersatzId: abschlagSteuersatzId,
          gueltigAb: abschlagGueltigAbRaw ? new Date(abschlagGueltigAbRaw) : parsed.data.einzugsdatum,
        },
      });
    }
    return mietpartei.id;
  });

  // Jede neue Mietpartei erhaelt sofort eine Kundennummer - auch Interessent:innen,
  // da sie Basis der SEPA-Mandatsreferenz auf dem Onboarding-SEPA-Mandat ist.
  await vergibKundennummerFallsNoetig(neueMietparteiId);

  revalidatePath("/admin/mietparteien");

  // Nach dem Anlegen: automatisch einen Schlussrechnungs-Entwurf fuer den
  // Vormieter erzeugen (best-effort - schlaegt es fehl, z.B. weil bereits eine
  // ueberschneidende Rechnung existiert, wird das nur protokolliert).
  if (vorhandener && vormieterAuszug) {
    try {
      const { rechnungId } = await erstelleRechnungsentwurf({
        mietparteiId: vorhandener.id,
        typ: "SCHLUSSRECHNUNG",
        von: vorhandener.einzugsdatum,
        bis: vormieterAuszug,
      });
      await generateAndStoreInvoicePdf(rechnungId).catch(() => {});
    } catch {
      // Nicht fatal: der Schlussrechnungs-Entwurf kann manuell nachgeholt werden.
    }
  }

  revalidatePath(`/admin/mietparteien/${neueMietparteiId}`);
  // Direkt zur Detail-/Vertragsunterlagen-Seite der neuen Mietpartei springen
  // (redirect() wirft NEXT_REDIRECT - bewusst ausserhalb jedes try/catch).
  redirect(`/admin/mietparteien/${neueMietparteiId}`);
}

/**
 * Legt Allgemeinstrom an: erzeugt in einem Schritt die Einheit (Typ
 * ALLGEMEINSTROM, feste Bezeichnung „Allgemeinstrom") UND die zugehoerige
 * Mietpartei = Vermieter:in (mit deren Anschrift, vorbelegt aus dem Objekt).
 * Kein Anschreiben, keine Ergaenzung. Optional wird am Objekt vermerkt, dass es
 * eine Waermepumpe gibt (deren Zaehler wird spaeter an der Einheit als
 * „Waermepumpe" markiert -> getrennter Rechnungsausweis).
 */
export async function createAllgemeinstromAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const objektId = String(formData.get("objektId") ?? "");
  const anredeRaw = String(formData.get("anrede") ?? "").trim();
  const anrede: Anrede = ["HERR", "FRAU", "FAMILIE", "FIRMA"].includes(anredeRaw) ? (anredeRaw as Anrede) : null;
  const istFirma = anrede === "FIRMA";
  const name = String(formData.get("name") ?? "").trim();
  const firma = String(formData.get("firma") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const anschriftPlz = String(formData.get("anschriftPlz") ?? "").trim();
  const anschriftOrt = String(formData.get("anschriftOrt") ?? "").trim();
  const einzugsdatumRaw = String(formData.get("einzugsdatum") ?? "");
  const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
  const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
  const hatGrundpreis = formData.get("hatGrundpreis") === "on";
  const grundpreisNetto = Number(formData.get("grundpreisNetto"));
  const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");
  const hatWaermepumpe = formData.get("hatWaermepumpe") === "on";

  // Optionale Zähler-Zuordnung direkt beim Anlegen: Allgemeinstrom-Zähler und -
  // falls Wärmepumpe - ein WP-Zähler (jeweils ADDIEREN/SUBTRAHIEREN).
  const allgemeinZaehlerId = String(formData.get("allgemeinZaehlerId") ?? "").trim();
  const allgemeinModus = String(formData.get("allgemeinModus") ?? "ADDIEREN") === "SUBTRAHIEREN" ? "SUBTRAHIEREN" : "ADDIEREN";
  const wpZaehlerId = hatWaermepumpe ? String(formData.get("wpZaehlerId") ?? "").trim() : "";
  const wpModus = String(formData.get("wpModus") ?? "ADDIEREN") === "SUBTRAHIEREN" ? "SUBTRAHIEREN" : "ADDIEREN";

  if (!objektId || !einzugsdatumRaw || !arbeitspreisSteuersatzId) {
    return { error: "Bitte Objekt, Lieferbeginn und Arbeitspreis angeben." };
  }
  if (istFirma ? !firma : !name) {
    return { error: istFirma ? "Bitte den Firmennamen angeben." : "Bitte den Namen der Vermieter:in angeben." };
  }
  if (!Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
    return { error: "Der Arbeitspreis ist ungültig." };
  }

  // Optionaler Abschlag (brutto).
  const abschlagBrutto = Number(formData.get("abschlagBrutto"));
  const abschlagSteuersatzId = String(formData.get("abschlagSteuersatzId") ?? "");
  const abschlagGueltigAbRaw = String(formData.get("abschlagGueltigAb") ?? "");
  const legeAbschlagAn = Number.isFinite(abschlagBrutto) && abschlagBrutto > 0 && Boolean(abschlagSteuersatzId);
  const abschlagSatz = legeAbschlagAn
    ? await prisma.steuersatz.findUnique({ where: { id: abschlagSteuersatzId } })
    : null;

  const einzugsdatum = new Date(einzugsdatumRaw);

  const neueMietparteiId = await prisma.$transaction(async (tx) => {
    const einheit = await tx.einheit.create({
      data: { objektId, bezeichnung: "Allgemeinstrom", typ: "ALLGEMEINSTROM" },
    });
    const mietpartei = await tx.mietpartei.create({
      data: {
        einheitId: einheit.id,
        anrede,
        name: istFirma ? "" : name,
        firma: istFirma ? firma : null,
        anschrift: anschrift || null,
        anschriftPlz,
        anschriftOrt,
        einzugsdatum,
        status: "AKTIV",
        // Allgemeinstrom: kein Anschreiben-/Ergaenzungsbedarf.
        braucheErgaenzung: false,
        arbeitspreisNetto,
        arbeitspreisSteuersatzId,
        grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
        grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
      },
    });
    if (legeAbschlagAn && abschlagSatz) {
      await tx.abschlag.create({
        data: {
          mietparteiId: mietpartei.id,
          bruttoBetrag: abschlagBrutto,
          nettoBetrag: berechneNettoAusBrutto(abschlagBrutto, abschlagSatz.prozentsatz),
          steuersatzId: abschlagSteuersatzId,
          gueltigAb: abschlagGueltigAbRaw ? new Date(abschlagGueltigAbRaw) : einzugsdatum,
        },
      });
    }
    if (hatWaermepumpe) {
      await tx.objekt.update({ where: { id: objektId }, data: { hatWaermepumpe: true } });
    }
    // Zähler-Zuordnungen: nur Geräte des gewählten Objekts zulassen (Defense in Depth).
    const gueltigeGeraetIds = new Set(
      (await tx.shellyGeraet.findMany({ where: { objektId }, select: { id: true } })).map((g) => g.id),
    );
    if (allgemeinZaehlerId && gueltigeGeraetIds.has(allgemeinZaehlerId)) {
      await tx.geraetZuordnung.create({
        data: { einheitId: einheit.id, shellyGeraetId: allgemeinZaehlerId, modus: allgemeinModus, istWaermepumpe: false },
      });
    }
    if (hatWaermepumpe && wpZaehlerId && gueltigeGeraetIds.has(wpZaehlerId) && wpZaehlerId !== allgemeinZaehlerId) {
      await tx.geraetZuordnung.create({
        data: { einheitId: einheit.id, shellyGeraetId: wpZaehlerId, modus: wpModus, istWaermepumpe: true },
      });
    }
    return mietpartei.id;
  });

  await vergibKundennummerFallsNoetig(neueMietparteiId);
  revalidatePath("/admin/mietparteien");
  revalidatePath("/admin/objekte");
  redirect(`/admin/mietparteien/${neueMietparteiId}`);
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
  // savedNonce erzwingt einen Remount der kontrollierten Felder (siehe key im
  // Formular), damit die Anzeige nach dem React-19-Formular-Reset den frisch
  // gespeicherten Werten entspricht.
  return { success: "Änderungen gespeichert.", savedNonce: Date.now().toString() };
}

// ---------------------------------------------------------------------------
// Fokussierte Teil-Updates (fuer die neu gestaltete Mietpartei-Detailseite:
// Anzeige in Read-only-Abschnitten, Bearbeiten je Aspekt ueber das +-Menue).
// Jede Action aktualisiert nur ihren Teilbereich (kein Ueberschreiben fremder
// Felder) und liefert `savedNonce` fuer den Formular-Remount.
// ---------------------------------------------------------------------------

/** Stammdaten: Einheit, Status, Liefer-Zeitraum und Kontaktangaben. */
export async function updateStammdatenAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const einheitId = String(formData.get("einheitId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const anschrift = String(formData.get("anschrift") ?? "").trim();
  const anschriftPlz = String(formData.get("anschriftPlz") ?? "").trim();
  const anschriftOrt = String(formData.get("anschriftOrt") ?? "").trim();
  const einzugsdatumRaw = String(formData.get("einzugsdatum") ?? "");
  const auszugsdatumRaw = String(formData.get("auszugsdatum") ?? "");
  const statusRaw = String(formData.get("status") ?? "AKTIV");
  const status = (["INTERESSENT", "AKTIV", "INAKTIV"].includes(statusRaw) ? statusRaw : "AKTIV") as
    | "INTERESSENT"
    | "AKTIV"
    | "INAKTIV";

  if (!id || !einheitId || !einzugsdatumRaw) {
    return { error: "Bitte Einheit und Beginn der Stromlieferung angeben.", values: collectValues(formData) };
  }

  await prisma.mietpartei.update({
    where: { id },
    data: {
      einheitId,
      email,
      telefon: telefon || null,
      anschrift: anschrift || null,
      anschriftPlz,
      anschriftOrt,
      einzugsdatum: new Date(einzugsdatumRaw),
      auszugsdatum: auszugsdatumRaw ? new Date(auszugsdatumRaw) : null,
      status,
    },
  });
  revalidatePath("/admin/mietparteien");
  revalidatePath(`/admin/mietparteien/${id}`);
  return { success: "Stammdaten gespeichert.", savedNonce: Date.now().toString() };
}

/** Personen: Hauptperson (Anrede + Name/Firma) und beliebig viele weitere Personen. */
export async function updatePersonenAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const anredeRaw = String(formData.get("anrede") ?? "").trim();
  const anrede: Anrede = ["HERR", "FRAU", "FAMILIE", "FIRMA"].includes(anredeRaw) ? (anredeRaw as Anrede) : null;
  const istFirma = anrede === "FIRMA";
  const vorname = String(formData.get("vorname") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const firma = String(formData.get("firma") ?? "").trim();
  const weiterePersonen = istFirma ? [] : parseWeiterePersonenForm(formData.get("weiterePersonen"));

  if (!id) return { error: "Mietpartei fehlt." };
  if (istFirma ? !firma : !name) {
    return {
      error: istFirma ? "Bitte den Firmennamen angeben." : "Bitte den Namen angeben.",
      values: collectValues(formData),
    };
  }

  await prisma.mietpartei.update({
    where: { id },
    data: {
      anrede,
      vorname,
      name: istFirma ? "" : name,
      firma: istFirma ? firma : null,
      weiterePersonen,
      vorname2: "",
      name2: "",
      anrede2: null,
    },
  });
  revalidatePath("/admin/mietparteien");
  revalidatePath(`/admin/mietparteien/${id}`);
  return { success: "Personen gespeichert.", savedNonce: Date.now().toString() };
}

/** Stromkosten: nur Arbeits-/Grundpreis. Der Abschlag wird bewusst separat über
 *  „Neuer Abschlag" gepflegt (eigener Menüpunkt), nicht mehr hier. */
export async function updateStromkostenAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const arbeitspreisNetto = Number(formData.get("arbeitspreisNetto"));
  const arbeitspreisSteuersatzId = String(formData.get("arbeitspreisSteuersatzId") ?? "");
  const hatGrundpreis = formData.get("hatGrundpreis") === "on";
  const grundpreisNetto = Number(formData.get("grundpreisNetto"));
  const grundpreisSteuersatzId = String(formData.get("grundpreisSteuersatzId") ?? "");

  if (!id || !arbeitspreisSteuersatzId || !Number.isFinite(arbeitspreisNetto) || arbeitspreisNetto < 0) {
    return { error: "Bitte einen gültigen Arbeitspreis und Steuersatz angeben.", values: collectValues(formData) };
  }

  await prisma.mietpartei.update({
    where: { id },
    data: {
      arbeitspreisNetto,
      arbeitspreisSteuersatzId,
      grundpreisNetto: hatGrundpreis && Number.isFinite(grundpreisNetto) ? grundpreisNetto : null,
      grundpreisSteuersatzId: hatGrundpreis && grundpreisSteuersatzId ? grundpreisSteuersatzId : null,
    },
  });

  revalidatePath(`/admin/mietparteien/${id}`);
  return { success: "Stromkosten gespeichert.", savedNonce: Date.now().toString() };
}

/** Bankverbindung: Kontoinhaber:in, IBAN (validiert) und daraus abgeleitete Bank/BIC. */
export async function updateBankverbindungAction(
  _prevState: MietparteiFormState,
  formData: FormData,
): Promise<MietparteiFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const kontoinhaber = String(formData.get("kontoinhaber") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();
  const bankNameManuell = String(formData.get("bankName") ?? "").trim();
  const iban = ibanRaw ? normalisiereIban(ibanRaw) : "";

  if (!id) return { error: "Mietpartei fehlt." };
  if (iban && !istGueltigeIban(iban)) {
    return { error: "Die IBAN ist ungültig (Prüfziffer stimmt nicht).", values: collectValues(formData) };
  }
  const bank = iban ? bankAusIban(iban) : null;

  await prisma.mietpartei.update({
    where: { id },
    data: {
      kontoinhaber,
      iban: iban || null,
      bankName: bank?.bankName || bankNameManuell || null,
      bicOderBlz: bank?.bic || null,
    },
  });
  revalidatePath(`/admin/mietparteien/${id}`);
  return { success: "Bankverbindung gespeichert.", savedNonce: Date.now().toString() };
}

/**
 * Live-Ermittlung von Bankname/BIC aus einer IBAN (fuer die Formular-Vorbefuellung
 * beim Eintippen). Gibt null zurueck, wenn die IBAN ungueltig oder unbekannt ist.
 */
export async function bankAusIbanAction(iban: string): Promise<{ bankName: string; bic: string } | null> {
  await requireAdmin();
  return bankAusIban(iban);
}

export interface AbschlagFormState {
  error?: string;
  // Wechselt bei jedem erfolgreichen Anlegen -> signalisiert dem Formular den
  // Erfolg (schließt das Panel im +-Menü).
  savedNonce?: string;
}

export async function createAbschlagAction(
  _prevState: AbschlagFormState,
  formData: FormData,
): Promise<AbschlagFormState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  const bruttoBetrag = Number(formData.get("bruttoBetrag"));
  const steuersatzId = String(formData.get("steuersatzId") ?? "");
  const gueltigAbRaw = String(formData.get("gueltigAb") ?? "");
  const gueltigBisRaw = String(formData.get("gueltigBis") ?? "");

  if (!steuersatzId || !gueltigAbRaw || !Number.isFinite(bruttoBetrag) || bruttoBetrag < 0) {
    return { error: "Bitte Betrag (inkl. MwSt.), Steuersatz und Gültig-ab-Datum angeben." };
  }
  const satz = await prisma.steuersatz.findUnique({ where: { id: steuersatzId } });
  if (!satz) return { error: "Steuersatz nicht gefunden." };
  const nettoBetrag = berechneNettoAusBrutto(bruttoBetrag, satz.prozentsatz);

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
        bruttoBetrag,
        nettoBetrag,
        steuersatzId,
        gueltigAb,
        gueltigBis: gueltigBisRaw ? new Date(gueltigBisRaw) : null,
      },
    });
  });

  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return { savedNonce: Date.now().toString() };
}

/**
 * Löscht einen Abschlag. Damit keine Lücke entsteht, erbt der unmittelbare
 * Vorgänger (nächst-früherer Abschlag) das Enddatum des gelöschten: Wird der
 * neueste (offene) Abschlag gelöscht, ist der Vorgänger danach wieder offen;
 * wird ein mittlerer gelöscht, reicht der Vorgänger bis zu dessen bisherigem Ende.
 */
export async function deleteAbschlagAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  if (!id) return;

  const abschlag = await prisma.abschlag.findUnique({ where: { id } });
  if (!abschlag) return;

  const vorgaenger = await prisma.abschlag.findFirst({
    where: { mietparteiId: abschlag.mietparteiId, gueltigAb: { lt: abschlag.gueltigAb } },
    orderBy: { gueltigAb: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.abschlag.delete({ where: { id } });
    if (vorgaenger) {
      await tx.abschlag.update({ where: { id: vorgaenger.id }, data: { gueltigBis: abschlag.gueltigBis } });
    }
  });

  revalidatePath(`/admin/mietparteien/${mietparteiId || abschlag.mietparteiId}`);
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
    // Ein Vertrags-Scan liegt vor, wenn eine der Vertragsarten (oder der Legacy-
    // Sammeltyp) hochgeladen wurde.
    const hatVertrag = mietpartei.dokumente.some(
      (d) => d.typ === "VERTRAG_EIGENSTAENDIG" || d.typ === "VERTRAG_ERGAENZUNG" || d.typ === "VERTRAG",
    );
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

/**
 * Aktualisiert die Onboarding-Optionen einer Mietpartei nachtraeglich:
 * Anschreiben-Variante (formal/persoenlich) und Ergaenzungs-Bedarf. Wird vom
 * OnboardingPanel genutzt, damit beide Optionen auch nach dem Anlegen aenderbar
 * bleiben.
 */
export async function setOnboardingOptionenAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireAdmin();

  const mietparteiId = String(formData.get("mietparteiId") ?? "");
  if (!mietparteiId) return { error: "Mietpartei fehlt." };
  const anschreibenVariante = formData.get("anschreibenVariante") === "persoenlich" ? "persoenlich" : "formal";
  const braucheErgaenzung = formData.get("braucheErgaenzung") === "on";

  await prisma.mietpartei.update({
    where: { id: mietparteiId },
    data: { anschreibenVariante, braucheErgaenzung },
  });
  revalidatePath(`/admin/mietparteien/${mietparteiId}`);
  return { success: "Onboarding-Optionen gespeichert." };
}

// Im Upload waehlbare Ruecklaeufer-Typen (Legacy VERTRAG/ANSCHREIBEN werden nicht
// mehr angeboten, bleiben aber fuer bereits abgelegte Dokumente gueltig).
const DOKUMENT_TYPEN: DokumentTyp[] = [
  "VERTRAG_EIGENSTAENDIG",
  "VERTRAG_ERGAENZUNG",
  "SEPA",
  "SONSTIGES",
];

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
