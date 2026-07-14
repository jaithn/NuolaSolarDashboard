import { prisma } from "@/lib/db";
import type { VertragArt, VertragVersion } from "@prisma/client";

// Menschlich lesbare Bezeichnung der Vertragsart.
export const VERTRAGSART_LABEL: Record<VertragArt, string> = {
  EIGENSTAENDIG: "Eigenständiger Vertrag",
  ERGAENZUNG: "Ergänzung zum Mietvertrag",
};

/** Aktuell gueltige Version einer Vertragsart (gueltigBis = null). */
export function aktiveVertragVersion(art: VertragArt): Promise<VertragVersion | null> {
  return prisma.vertragVersion.findFirst({
    where: { art, gueltigBis: null },
    orderBy: { gueltigAb: "desc" },
  });
}
