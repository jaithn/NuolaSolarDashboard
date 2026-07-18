import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import type { DokumentTyp } from "@prisma/client";

// Gescannte Mietpartei-Dokumente (Onboarding-Ruecklaeufer) liegen bewusst im
// data-Volume und NICHT unter public/ - Zugriff nur authentifiziert ueber einen
// Route-Handler (personenbezogene Daten). Ablage pro Mietpartei in einem eigenen
// Unterordner, damit die Struktur dauerhaft nachvollziehbar bleibt:
//   data/mietparteien/<mietparteiId>/<gespeicherter-dateiname>
const DOKUMENTE_BASIS_DIR = path.join(process.cwd(), "data", "mietparteien");

// Erlaubte Dateitypen (Scan eines Vertrags/Mandats): PDF oder Bilddatei.
const ERLAUBTE_ENDUNGEN = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
export const MAX_DOKUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

/** Nur einfache ID-/Dateinamens-Bestandteile zulassen (Defense in Depth gegen Path Traversal). */
function assertSicher(mietparteiId: string, dateiname: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(mietparteiId)) {
    throw new Error(`Unzulässige Mietpartei-ID: ${mietparteiId}`);
  }
  if (dateiname !== path.basename(dateiname) || !/^[A-Za-z0-9._-]+$/.test(dateiname)) {
    throw new Error(`Unzulässiger Dateiname: ${dateiname}`);
  }
}

/** Absoluter Pfad einer abgelegten Datei (mit Traversal-Schutz). */
export function resolveDokumentPfad(mietparteiId: string, gespeicherterName: string): string {
  assertSicher(mietparteiId, gespeicherterName);
  return path.join(DOKUMENTE_BASIS_DIR, mietparteiId, gespeicherterName);
}

/** Endung inkl. Punkt in Kleinbuchstaben (z.B. ".pdf"), leer wenn keine. */
function endungVon(name: string): string {
  return path.extname(name).toLowerCase();
}

export function istErlaubteDatei(name: string): boolean {
  return ERLAUBTE_ENDUNGEN.has(endungVon(name));
}

/**
 * Speichert eine hochgeladene Datei dauerhaft und legt den DB-Datensatz an.
 * Der gespeicherte Dateiname wird serverseitig vergeben (Zeitstempel + Typ +
 * bereinigte Endung), der Originalname bleibt als Anzeigename erhalten.
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

  const gespeicherterName = `${typ.toLowerCase()}-${Date.now()}${endung}`;
  assertSicher(mietparteiId, gespeicherterName);

  const zielPfad = resolveDokumentPfad(mietparteiId, gespeicherterName);
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
//   data/mietparteien/<mietparteiId>/generiert/<dok>.pdf
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
export function resolveGeneriertesPdfPfad(mietparteiId: string, dok: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(mietparteiId)) {
    throw new Error(`Unzulässige Mietpartei-ID: ${mietparteiId}`);
  }
  if (!GENERIERTE_DOKS.has(dok)) {
    throw new Error(`Unzulässiges Onboarding-Dokument: ${dok}`);
  }
  return path.join(DOKUMENTE_BASIS_DIR, mietparteiId, GENERIERT_UNTERORDNER, `${dok}.pdf`);
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
  const zielPfad = resolveGeneriertesPdfPfad(mietparteiId, dok);
  await mkdir(path.dirname(zielPfad), { recursive: true });
  await writeFile(zielPfad, bytes);
}

/** Löscht Datei und Datensatz eines Dokuments (Datei-Fehler werden ignoriert). */
export async function loescheDokument(dokumentId: string): Promise<void> {
  const dok = await prisma.mietparteiDokument.findUnique({ where: { id: dokumentId } });
  if (!dok) return;
  await unlink(resolveDokumentPfad(dok.mietparteiId, dok.pfad)).catch(() => {});
  await prisma.mietparteiDokument.delete({ where: { id: dokumentId } });
}
