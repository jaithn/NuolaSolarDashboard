import { syncDokumenteVorlagen } from "@/lib/dokumenteSync";
import { prisma } from "@/lib/db";

// CLI: Texte aus dem "Dokumente"-Ordner in die DB uebernehmen.
// Aufruf: npm run sync:dokumente
async function main() {
  const r = await syncDokumenteVorlagen();
  console.log(`Vertragsversionen: ${r.vertragsversionen}, Briefvorlagen: ${r.briefvorlagen}`);
  for (const w of r.warnungen) console.warn(`WARN: ${w}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
