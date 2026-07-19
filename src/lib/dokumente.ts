import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import type { DokumentTyp } from "@prisma/client";

// Gescannte Mietpartei-Dokumente (Onboarding-Ruecklaeufer) liegen bewusst im
// data-Volume und NICHT unter public/ - Zugriff nur authentifiziert ueber einen
// Route-Handler (personenbezogene Daten). Ablage pro Kundin/Kunde in einem eigenen
// Unterordner, benannt nach der KUNDENNUMMER (jede Mietpartei erhaelt sie beim
// Anlegen), damit die Struktur sortierbar und nachvollziehbar bleibt:
//   data/kunden/<kundennummer>/<gespeicherter-dateiname>
const DOKUMENTE_BASIS_DIR = path.join(process.cwd(), "data", "kunden");

// Erlaubte Dateitypen (Scan eines Vertrags/Mandats): PDF oder Bilddatei.
const ERLAUBTE_ENDUNGEN = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
export const MAX_DOKUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Ordnerschluessel einer Mietpartei im data/kunden-Verzeichnis: die Kundennummer
 * (jede Mietpartei erhaelt sie beim Anlegen), Fallback die Mietpartei-ID.
 */
export async function kundenOrdner(mietparteiId: string): Promise<string> {
  const mp = await prisma.mietpartei.findUnique({
    where: { id: mietparteiId },
    select: { kundennummer: true },
  });
  return mp?.kundennummer != null ? String(mp.kundennummer) : mietparteiId;
}

/** Nur einfache Ordner-/Dateinamens-Bestandteile zulassen (Defense in Depth gegen Path Traversal). */
function assertSicher(ordner: string, dateiname: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(ordner)) {
    throw new Error(`Unzulässiger Ordnerschlüssel: ${ordner}`);
  }
  if (dateiname !== path.basename(dateiname) || !/^[A-Za-z0-9._-]+$/.test(dateiname)) {
    throw new Error(`Unzulässiger Dateiname: ${dateiname}`);
  }
}

/** Absoluter Pfad einer abgelegten Datei (mit Traversal-Schutz). */
export function resolveDokumentPfad(ordner: string, gespeicherterName: string): string {
  assertSicher(ordner, gespeicherterName);
  return path.join(DOKUMENTE_BASIS_DIR, ordner, gespeicherterName);
}

/** Endung inkl. Punkt in Kleinbuchstaben (z.B. ".pdf"), leer wenn keine. */
function endungVon(name: string): string {
  return path.extname(name).toLowerCase();
}

export function istErlaubteDatei(name: string): boolean {
  return ERLAUBTE_ENDUNGEN.has(endungVon(name));
}

/** Namensbestandteil aus Personen-/Firmenname (Umlaut-Transliteration, nur [A-Za-z0-9-]). */
function slugName(s: string): string {
  const slug = s
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "Unterlage";
}

/** Ersten freien Dateinamen im Ordner finden (bei Kollision -2, -3, …). */
function eindeutigerDateiname(ordner: string, basis: string, endung: string): string {
  let name = `${basis}${endung}`;
  let i = 2;
  while (existsSync(resolveDokumentPfad(ordner, name))) {
    name = `${basis}-${i}${endung}`;
    i++;
  }
  return name;
}

/**
 * Speichert eine hochgeladene Datei dauerhaft und legt den DB-Datensatz an.
 * Der gespeicherte Dateiname wird serverseitig einheitlich vergeben:
 *   <kundennummer>_<Name>_<TYP>_<YYYY-MM-DD>.<endung>
 * (z.B. "10001_Mueller_SEPA_2026-07-19.pdf"). Der Originalname bleibt als
 * Anzeigename (dateiname) erhalten.
 */
export async function speichereDokument(params: {
  mietparteiId: string;
  typ: DokumentTyp;
  originalName: string;
  bytes: Buffer;
}): Promise<void> {
  const { mietparteiId, typ, originalName, bytes } = params;
  const endung = endungVon(originalName);
  if (!ERLAUBTE_ENDUNGEN.has(endung)) {
    throw new Error("Nur PDF-, JPG- oder PNG-Dateien sind erlaubt.");
  }
  if (bytes.length === 0) throw new Error("Die Datei ist leer.");
  if (bytes.length > MAX_DOKUMENT_BYTES) throw new Error("Die Datei ist zu groß (max. 20 MB).");

  const mp = await prisma.mietpartei.findUnique({
    where: { id: mietparteiId },
    select: { kundennummer: true, name: true, firma: true },
  });
  const ordner = mp?.kundennummer != null ? String(mp.kundennummer) : mietparteiId;
  const kundennrTeil = mp?.kundennummer != null ? String(mp.kundennummer) : "kunde";
  const nameTeil = slugName(mp?.firma?.trim() || mp?.name?.trim() || "");
  const datum = new Date().toISOString().slice(0, 10);
  const gespeicherterName = eindeutigerDateiname(ordner, `${kundennrTeil}_${nameTeil}_${typ}_${datum}`, endung);
  assertSicher(ordner, gespeicherterName);

  const zielPfad = resolveDokumentPfad(ordner, gespeicherterName);
  await mkdir(path.dirname(zielPfad), { recursive: true });
  await writeFile(zielPfad, bytes);

  await prisma.mietparteiDokument.create({
    data: {
      mietparteiId,
      typ,
      dateiname: originalName.slice(0, 200),
      pfad: gespeicherterName,
      groesseBytes: bytes.length,
    },
  });
}

// Vom System erzeugte Onboarding-PDFs (Anschreiben/Vertraege/SEPA) werden beim
// Abruf zusaetzlich dauerhaft im data-Volume abgelegt - in einem eigenen
// Unterordner, damit sie NICHT mit den hochgeladenen, unterschriebenen Scans
// (den MietparteiDokument-Datensaetzen) vermischt werden:
//   data/kunden/<kundennummer>/generiert/<dok>.pdf
// Pro Dokumenttyp wird die jeweils zuletzt erzeugte Version gehalten
// (Ueberschreiben), sodass das Volume stets die aktuell ausgegebene Fassung
// enthaelt.
const GENERIERT_UNTERORDNER = "generiert";

/** Erlaubte Onboarding-Dokumentschluessel (zugleich Traversal-Schutz fuer den Dateinamen). */
const GENERIERTE_DOKS = new Set([
  "anschreiben",
  "anschreiben-persoenlich",
  "vertrag-eigenstaendig",
  "vertrag-ergaenzung",
  "sepa",
]);

/** Absoluter Ablagepfad eines generierten Onboarding-PDFs (mit Traversal-Schutz). */
export function resolveGeneriertesPdfPfad(ordner: string, dok: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(ordner)) {
    throw new Error(`Unzulässiger Ordnerschlüssel: ${ordner}`);
  }
  if (!GENERIERTE_DOKS.has(dok)) {
    throw new Error(`Unzulässiges Onboarding-Dokument: ${dok}`);
  }
  return path.join(DOKUMENTE_BASIS_DIR, ordner, GENERIERT_UNTERORDNER, `${dok}.pdf`);
}

/**
 * Legt ein frisch erzeugtes Onboarding-PDF dauerhaft im data-Volume ab
 * (ueberschreibt die vorherige Fassung desselben Dokumenttyps). Bewusst
 * best-effort: der Abruf selbst darf durch einen Schreibfehler nicht scheitern.
 */
export async function speichereGeneriertesOnboardingPdf(
  mietparteiId: string,
  dok: string,
  bytes: Buffer,
): Promise<void> {
  const ordner = await kundenOrdner(mietparteiId);
  const zielPfad = resolveGeneriertesPdfPfad(ordner, dok);
  await mkdir(path.dirname(zielPfad), { recursive: true });
  await writeFile(zielPfad, bytes);
}

/** Löscht Datei und Datensatz eines Dokuments (Datei-Fehler werden ignoriert). */
export async function loescheDokument(dokumentId: string): Promise<void> {
  const dok = await prisma.mietparteiDokument.findUnique({ where: { id: dokumentId } });
  if (!dok) return;
  const ordner = await kundenOrdner(dok.mietparteiId);
  await unlink(resolveDokumentPfad(ordner, dok.pfad)).catch(() => {});
  await prisma.mietparteiDokument.delete({ where: { id: dokumentId } });
}
