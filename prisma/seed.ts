import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { syncDokumenteVorlagen } from "@/lib/dokumenteSync";

const prisma = new PrismaClient();

async function main() {
  await prisma.steuersatz.upsert({
    where: { id: "seed-ust-19" },
    update: {},
    create: {
      id: "seed-ust-19",
      bezeichnung: "Regulärer Steuersatz",
      prozentsatz: 19,
      gueltigAb: new Date("2007-01-01T00:00:00.000Z"),
    },
  });

  await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "Nuola Solar GbR",
      anschrift: "Bitte in den Firmenstammdaten ergänzen",
      steuernummer: null,
      ustIdNr: null,
      bankverbindung: null,
    },
  });

  await prisma.rechnungsDesignvorlage.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const existingAdmin = await prisma.nutzer.findFirst({ where: { role: "ADMIN" } });
  if (!existingAdmin) {
    const initialPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    await prisma.nutzer.create({
      data: {
        username: "admin",
        passwordHash,
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
    console.log("Admin-Zugang angelegt:");
    console.log("  Benutzername: admin");
    console.log(`  Einmal-Passwort: ${initialPassword}`);
    console.log("Bitte nach dem ersten Login sofort ändern.");
  } else {
    console.log("Admin-Nutzer existiert bereits, überspringe Anlage.");
  }

  // Vertrags- und Brieftexte aus dem "Dokumente"-Ordner einlesen (idempotent).
  try {
    const r = await syncDokumenteVorlagen();
    console.log(`Vorlagen-Sync: ${r.vertragsversionen} Vertragsversionen, ${r.briefvorlagen} Briefvorlagen.`);
    for (const w of r.warnungen) console.warn(`  WARN: ${w}`);
  } catch (err) {
    console.warn("Vorlagen-Sync übersprungen:", err instanceof Error ? err.message : err);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
