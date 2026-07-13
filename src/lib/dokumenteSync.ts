import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { parseFrontMatter } from "@/lib/dokumenteVorlagen";
import type { VertragArt } from "@prisma/client";

// Ueberfuehrt die editierbaren Texte aus dem "Dokumente"-Ordner in die DB:
// Vertragsversionen (mit automatischer Historie/Gueltigkeit) und Brief-Vorlagen.
// Idempotent - kann beliebig oft ausgefuehrt werden (Seed/CLI/Admin-Button).

function dokumenteDir(): string {
  return path.join(process.cwd(), "Dokumente");
}

// Dateiname (ohne "brief-"/".md") -> Schluessel der BriefVorlage.
const BRIEF_SCHLUESSEL: Record<string, string> = {
  anschreiben: "anschreiben",
  "sepa-mandat": "sepa",
  willkommen: "willkommen",
};

const GUELTIGE_ARTEN: VertragArt[] = ["EIGENSTAENDIG", "ERGAENZUNG"];

/** Tag vor dem uebergebenen Datum (fuer lueckenlose gueltigBis-Grenzen). */
function tagVor(datum: Date): Date {
  const d = new Date(datum);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export interface SyncErgebnis {
  vertragsversionen: number;
  briefvorlagen: number;
  warnungen: string[];
}

export async function syncDokumenteVorlagen(): Promise<SyncErgebnis> {
  const dir = dokumenteDir();
  const warnungen: string[] = [];
  let dateien: string[];
  try {
    dateien = await readdir(dir);
  } catch {
    return { vertragsversionen: 0, briefvorlagen: 0, warnungen: [`Ordner nicht gefunden: ${dir}`] };
  }

  // --- Vertraege -----------------------------------------------------------
  const vertragDateien = dateien.filter((f) => f.startsWith("vertrag-") && f.endsWith(".md"));
  const beruehrteArten = new Set<VertragArt>();
  let vertragsversionen = 0;

  for (const datei of vertragDateien) {
    const inhalt = await readFile(path.join(dir, datei), "utf8");
    const { meta, body } = parseFrontMatter(inhalt);
    const art = meta.art as VertragArt;
    const version = meta.version?.trim();
    const titel = meta.titel?.trim();
    const gueltigAbRaw = meta.gueltigAb?.trim();

    if (!GUELTIGE_ARTEN.includes(art) || !version || !titel || !gueltigAbRaw) {
      warnungen.push(`${datei}: unvollständiges Front-Matter (art/version/titel/gueltigAb) – übersprungen.`);
      continue;
    }
    const gueltigAb = new Date(gueltigAbRaw);
    if (Number.isNaN(gueltigAb.getTime())) {
      warnungen.push(`${datei}: ungültiges gueltigAb „${gueltigAbRaw}" – übersprungen.`);
      continue;
    }

    await prisma.vertragVersion.upsert({
      where: { art_version: { art, version } },
      update: { titel, inhaltMd: body, gueltigAb },
      create: { art, version, titel, inhaltMd: body, gueltigAb },
    });
    beruehrteArten.add(art);
    vertragsversionen++;
  }

  // Historie/Gueltigkeit je Art neu bestimmen: alle Versionen nach gueltigAb
  // sortieren; jede Version (ausser der letzten) endet am Tag vor Beginn der
  // naechsten, die letzte bleibt offen (gueltigBis = null).
  for (const art of beruehrteArten) {
    const versionen = await prisma.vertragVersion.findMany({
      where: { art },
      orderBy: { gueltigAb: "asc" },
    });
    for (let i = 0; i < versionen.length; i++) {
      const aktuell = versionen[i];
      if (!aktuell) continue;
      const naechste = versionen[i + 1];
      const gueltigBis = naechste ? tagVor(naechste.gueltigAb) : null;
      if (aktuell.gueltigBis?.getTime() !== gueltigBis?.getTime()) {
        await prisma.vertragVersion.update({ where: { id: aktuell.id }, data: { gueltigBis } });
      }
    }
  }

  // --- Briefe --------------------------------------------------------------
  const briefDateien = dateien.filter((f) => f.startsWith("brief-") && f.endsWith(".md"));
  let briefvorlagen = 0;
  for (const datei of briefDateien) {
    const name = datei.slice("brief-".length, -".md".length);
    const schluessel = BRIEF_SCHLUESSEL[name];
    if (!schluessel) {
      warnungen.push(`${datei}: kein bekannter Brief-Schlüssel – übersprungen.`);
      continue;
    }
    const inhalt = await readFile(path.join(dir, datei), "utf8");
    await prisma.briefVorlage.upsert({
      where: { schluessel },
      update: { inhaltMd: inhalt },
      create: { schluessel, inhaltMd: inhalt },
    });
    briefvorlagen++;
  }

  return { vertragsversionen, briefvorlagen, warnungen };
}
