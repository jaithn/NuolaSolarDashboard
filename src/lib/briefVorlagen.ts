import { prisma } from "@/lib/db";
import { parseAbschnitte } from "@/lib/dokumenteVorlagen";

// Laedt die benannten Abschnitte einer Brief-Vorlage aus der DB. Fehlt die
// Vorlage (noch kein Sync gelaufen), wird eine leere Map zurueckgegeben - die
// PDF-Komponenten fallen dann auf ihre im Code hinterlegten Standardtexte zurueck.
export async function ladeBriefAbschnitte(schluessel: string): Promise<Map<string, string>> {
  const vorlage = await prisma.briefVorlage.findUnique({ where: { schluessel } });
  return vorlage ? parseAbschnitte(vorlage.inhaltMd) : new Map();
}
