import path from "node:path";
import { existsSync } from "node:fs";
import { rename, readdir, mkdir } from "node:fs/promises";
import { prisma } from "@/lib/db";

// Einmalige Migration: benennt die frueheren, nach Mietpartei-ID benannten
// Dokumentordner in nach KUNDENNUMMER benannte Ordner um.
//   data/mietparteien/<mietparteiId>/…  ->  data/kunden/<kundennummer>/…
// Idempotent und best-effort: existiert der Zielordner bereits, werden die
// Dateien einzeln hineinverschoben (bereits vorhandene bleiben unberuehrt).
// Aufruf: npm run migrate:kundenordner  (auch im Docker-Entrypoint, best-effort).
const ALT_BASIS = path.join(process.cwd(), "data", "mietparteien");
const NEU_BASIS = path.join(process.cwd(), "data", "kunden");

async function verschiebeOrdnerInhalt(quelle: string, ziel: string): Promise<number> {
  await mkdir(ziel, { recursive: true });
  const eintraege = await readdir(quelle, { withFileTypes: true });
  let bewegt = 0;
  for (const e of eintraege) {
    const von = path.join(quelle, e.name);
    const nach = path.join(ziel, e.name);
    if (existsSync(nach)) continue; // nichts ueberschreiben
    if (e.isDirectory()) {
      bewegt += await verschiebeOrdnerInhalt(von, nach);
    } else {
      await rename(von, nach);
      bewegt++;
    }
  }
  return bewegt;
}

async function main() {
  if (!existsSync(ALT_BASIS)) {
    console.log("Kein Alt-Ordner data/mietparteien vorhanden – nichts zu migrieren.");
    await prisma.$disconnect();
    return;
  }

  const mietparteien = await prisma.mietpartei.findMany({ select: { id: true, kundennummer: true } });
  const nummerFuerId = new Map(mietparteien.map((m) => [m.id, m.kundennummer]));

  const alteOrdner = await readdir(ALT_BASIS, { withFileTypes: true });
  let migriert = 0;
  for (const eintrag of alteOrdner) {
    if (!eintrag.isDirectory()) continue;
    const mietparteiId = eintrag.name;
    const nummer = nummerFuerId.get(mietparteiId);
    // Ordnerschluessel: Kundennummer, Fallback die ID (unbekannte/verwaiste Ordner).
    const ordner = nummer != null ? String(nummer) : mietparteiId;
    const quelle = path.join(ALT_BASIS, mietparteiId);
    const ziel = path.join(NEU_BASIS, ordner);
    const bewegt = await verschiebeOrdnerInhalt(quelle, ziel);
    if (bewegt > 0) {
      console.log(`Migriert: ${mietparteiId} -> kunden/${ordner} (${bewegt} Datei(en))`);
      migriert++;
    }
  }

  console.log(`Fertig. ${migriert} Kundenordner migriert.`);

  // Zusaetzlich: bestehende Rechnungs-PDFs aus data/rechnungen/<id>.pdf in den
  // jeweiligen Kundenordner data/kunden/<kundennummer>/rechnungen/ verschieben.
  const ALT_RECHNUNGEN = path.join(process.cwd(), "data", "rechnungen");
  if (existsSync(ALT_RECHNUNGEN)) {
    const rechnungen = await prisma.rechnung.findMany({
      where: { pdfPfad: { not: null } },
      select: { pdfPfad: true, mietpartei: { select: { id: true, kundennummer: true } } },
    });
    let rMigriert = 0;
    for (const r of rechnungen) {
      if (!r.pdfPfad) continue;
      const quelle = path.join(ALT_RECHNUNGEN, r.pdfPfad);
      if (!existsSync(quelle)) continue;
      const ordner = r.mietpartei.kundennummer != null ? String(r.mietpartei.kundennummer) : r.mietpartei.id;
      const zielDir = path.join(NEU_BASIS, ordner, "rechnungen");
      const ziel = path.join(zielDir, r.pdfPfad);
      if (existsSync(ziel)) continue;
      await mkdir(zielDir, { recursive: true });
      await rename(quelle, ziel);
      rMigriert++;
    }
    if (rMigriert > 0) console.log(`Rechnungs-PDFs migriert: ${rMigriert}.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
