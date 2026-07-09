// Demo-/Testdaten zum Ausprobieren der Anwendung im Browser - NICHT fuer den
// echten Betrieb gedacht (bekannte, schwache Passwoerter ohne Zwang zur
// Aenderung). Alle Demo-Objekte tragen den Zusatz "(Demo)" im Namen und
// koennen jederzeit ueber den Admin-Bereich geloescht werden.
//
// Aufruf: npx tsx prisma/demo-seed.ts   (bzw. "npm run db:demo-seed")

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { erstelleRechnungsentwurf } from "../src/lib/billing/generateInvoice";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";
const HEUTE = new Date();

function tageVor(anzahl: number): Date {
  const d = new Date(HEUTE);
  d.setDate(d.getDate() - anzahl);
  return d;
}

// Einfache deterministische Pseudo-Zufallszahl (0..1), damit wiederholte
// Skript-Laeufe reproduzierbare Demo-Werte liefern.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Erzeugt taegliche kumulative Zaehlerstaende (Wh) fuer ein Geraet ueber den
 * angegebenen Zeitraum, mit leichter saisonaler Schwankung (Winter etwas
 * hoeherer Verbrauch) und kleinem Rauschen - genug fuer plausible
 * Monats-/Jahresvergleiche im Dashboard.
 */
async function simuliereMesswerte(params: {
  geraetId: string;
  phase: string;
  startDatum: Date;
  endDatum: Date;
  basisKwhProTag: number;
  seedOffset: number;
}) {
  const { geraetId, phase, startDatum, endDatum, basisKwhProTag, seedOffset } = params;
  const rows: { geraetId: string; phase: string; timestamp: Date; energyWh: number }[] = [];

  let kumuliertWh = 0;
  const tag = new Date(startDatum);
  let i = 0;
  while (tag <= endDatum) {
    const monat = tag.getMonth(); // 0 = Januar
    const istWinter = monat === 10 || monat === 11 || monat === 0 || monat === 1;
    const saisonFaktor = istWinter ? 1.3 : 1.0;
    const rauschen = 0.85 + pseudoRandom(seedOffset + i) * 0.3; // 0.85 .. 1.15
    const tagesWh = basisKwhProTag * 1000 * saisonFaktor * rauschen;
    kumuliertWh += tagesWh;

    rows.push({ geraetId, phase, timestamp: new Date(tag), energyWh: Math.round(kumuliertWh) });

    tag.setDate(tag.getDate() + 1);
    i += 1;
  }

  for (let j = 0; j < rows.length; j += 200) {
    await prisma.messwert.createMany({ data: rows.slice(j, j + 200) });
  }
}

async function loescheAlteDemoDaten() {
  const alte = await prisma.objekt.findMany({ where: { name: { endsWith: "(Demo)" } } });
  for (const o of alte) {
    await prisma.objekt.delete({ where: { id: o.id } }); // kaskadiert Einheiten/Geraete/Zuordnungen/Messwerte/Mietparteien
  }
}

async function main() {
  console.log("Räume alte Demo-Daten auf...");
  await loescheAlteDemoDaten();

  const steuersatz19 = await prisma.steuersatz.upsert({
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
      anschrift: "Musterstraße 1, 12345 Musterstadt",
      steuernummer: "DE-DEMO-123456789",
      bankverbindung: "DE00 0000 0000 0000 0000 00 (Demo-IBAN)",
    },
  });

  await prisma.rechnungsDesignvorlage.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.nutzer.upsert({
    where: { username: "admin" },
    update: { passwordHash: demoPasswordHash, mustChangePassword: false, role: "ADMIN" },
    create: { username: "admin", passwordHash: demoPasswordHash, role: "ADMIN", mustChangePassword: false },
  });

  console.log("Lege Objekt 'Olfen (Demo)' an...");
  const olfen = await prisma.objekt.create({
    data: { name: "Olfen (Demo)", adresse: "Hauptstraße 12, 45711 Olfen" },
  });
  const olfenEg = await prisma.einheit.create({ data: { objektId: olfen.id, bezeichnung: "Whg. EG links" } });
  const olfenOg = await prisma.einheit.create({ data: { objektId: olfen.id, bezeichnung: "Whg. 1.OG rechts" } });

  const geraetOlfenEg = await prisma.shellyGeraet.create({
    data: {
      objektId: olfen.id,
      deviceId: "demo-olfen-eg",
      serverHost: "shelly-demo.shelly.cloud",
      bezeichnung: "Pro 3EM Whg. EG links",
    },
  });
  const geraetOlfenOg = await prisma.shellyGeraet.create({
    data: {
      objektId: olfen.id,
      deviceId: "demo-olfen-og",
      serverHost: "shelly-demo.shelly.cloud",
      bezeichnung: "Pro 3EM Whg. 1.OG rechts",
    },
  });
  const geraetOlfenAllgemeinstrom = await prisma.shellyGeraet.create({
    data: {
      objektId: olfen.id,
      deviceId: "demo-olfen-allgemeinstrom",
      serverHost: "shelly-demo.shelly.cloud",
      bezeichnung: "Allgemeinstrom-Zwischenzähler (Keller/Flur)",
    },
  });

  // Zeigt genau das Szenario "Allgemeinstrom haengt im Stromkreis eines
  // Mieters": derselbe Zwischenzaehler wird bei BEIDEN Wohnungen als
  // SUBTRAHIEREN zugeordnet.
  await prisma.geraetZuordnung.createMany({
    data: [
      { einheitId: olfenEg.id, shellyGeraetId: geraetOlfenEg.id, modus: "ADDIEREN" },
      { einheitId: olfenEg.id, shellyGeraetId: geraetOlfenAllgemeinstrom.id, modus: "SUBTRAHIEREN" },
      { einheitId: olfenOg.id, shellyGeraetId: geraetOlfenOg.id, modus: "ADDIEREN" },
      { einheitId: olfenOg.id, shellyGeraetId: geraetOlfenAllgemeinstrom.id, modus: "SUBTRAHIEREN" },
    ],
  });

  const messwertStart = tageVor(430); // ca. 14 Monate, deckt volles Vorjahr ab
  console.log("Simuliere Messwerte (kann kurz dauern)...");
  await simuliereMesswerte({
    geraetId: geraetOlfenEg.id,
    phase: "a",
    startDatum: messwertStart,
    endDatum: HEUTE,
    basisKwhProTag: 6,
    seedOffset: 1,
  });
  await simuliereMesswerte({
    geraetId: geraetOlfenOg.id,
    phase: "a",
    startDatum: messwertStart,
    endDatum: HEUTE,
    basisKwhProTag: 5,
    seedOffset: 2,
  });
  await simuliereMesswerte({
    geraetId: geraetOlfenAllgemeinstrom.id,
    phase: "a",
    startDatum: messwertStart,
    endDatum: HEUTE,
    basisKwhProTag: 1.5,
    seedOffset: 3,
  });

  const annaMietpartei = await prisma.mietpartei.create({
    data: {
      einheitId: olfenEg.id,
      name: "Anna Schmidt",
      email: "anna.schmidt@example.com",
      telefon: "0170 1234567",
      anschrift: "Hauptstraße 12, 45711 Olfen",
      einzugsdatum: tageVor(730),
      status: "AKTIV",
      arbeitspreisNetto: 0.32,
      arbeitspreisSteuersatzId: steuersatz19.id,
      grundpreisNetto: 5,
      grundpreisSteuersatzId: steuersatz19.id,
    },
  });
  await prisma.abschlag.create({
    data: {
      mietparteiId: annaMietpartei.id,
      nettoBetrag: 45,
      steuersatzId: steuersatz19.id,
      gueltigAb: tageVor(730),
    },
  });
  await prisma.nutzer.create({
    data: {
      username: "anna.schmidt",
      passwordHash: demoPasswordHash,
      role: "MIETER",
      mustChangePassword: false,
      mietparteiId: annaMietpartei.id,
    },
  });

  const peterMietpartei = await prisma.mietpartei.create({
    data: {
      einheitId: olfenOg.id,
      name: "Peter Klein",
      email: "peter.klein@example.com",
      anschrift: "Hauptstraße 12, 45711 Olfen",
      einzugsdatum: tageVor(365),
      status: "AKTIV",
      arbeitspreisNetto: 0.3,
      arbeitspreisSteuersatzId: steuersatz19.id,
    },
  });
  await prisma.abschlag.create({
    data: {
      mietparteiId: peterMietpartei.id,
      nettoBetrag: 40,
      steuersatzId: steuersatz19.id,
      gueltigAb: tageVor(365),
    },
  });
  await prisma.nutzer.create({
    data: {
      username: "peter.klein",
      passwordHash: demoPasswordHash,
      role: "MIETER",
      mustChangePassword: false,
      mietparteiId: peterMietpartei.id,
    },
  });

  console.log("Lege Objekt 'Köln-Buchforst (Demo)' an...");
  const koeln = await prisma.objekt.create({
    data: { name: "Köln-Buchforst (Demo)", adresse: "Buchforstweg 5, 51065 Köln" },
  });
  const koelnWhg2 = await prisma.einheit.create({ data: { objektId: koeln.id, bezeichnung: "Whg. 2" } });
  const koelnWhg3 = await prisma.einheit.create({ data: { objektId: koeln.id, bezeichnung: "Whg. 3 (aktuell leer)" } });

  const geraetKoelnWhg2 = await prisma.shellyGeraet.create({
    data: {
      objektId: koeln.id,
      deviceId: "demo-koeln-whg2",
      serverHost: "shelly-demo.shelly.cloud",
      bezeichnung: "Pro 3EM Whg. 2",
    },
  });
  await prisma.geraetZuordnung.create({
    data: { einheitId: koelnWhg2.id, shellyGeraetId: geraetKoelnWhg2.id, modus: "ADDIEREN" },
  });
  await simuliereMesswerte({
    geraetId: geraetKoelnWhg2.id,
    phase: "a",
    startDatum: messwertStart,
    endDatum: HEUTE,
    basisKwhProTag: 7,
    seedOffset: 4,
  });
  // Whg. 3 bewusst ohne Geraet/Mietpartei - zeigt eine leerstehende Einheit.
  void koelnWhg3;

  const yilmazMietpartei = await prisma.mietpartei.create({
    data: {
      einheitId: koelnWhg2.id,
      name: "Familie Yilmaz",
      email: "familie.yilmaz@example.com",
      anschrift: "Buchforstweg 5, 51065 Köln",
      einzugsdatum: tageVor(240),
      status: "AKTIV",
      arbeitspreisNetto: 0.31,
      arbeitspreisSteuersatzId: steuersatz19.id,
      grundpreisNetto: 6,
      grundpreisSteuersatzId: steuersatz19.id,
    },
  });
  await prisma.abschlag.create({
    data: {
      mietparteiId: yilmazMietpartei.id,
      nettoBetrag: 55,
      steuersatzId: steuersatz19.id,
      gueltigAb: tageVor(240),
    },
  });
  await prisma.nutzer.create({
    data: {
      username: "familie.yilmaz",
      passwordHash: demoPasswordHash,
      role: "MIETER",
      mustChangePassword: false,
      mietparteiId: yilmazMietpartei.id,
    },
  });

  console.log("Erstelle Beispiel-Rechnungsentwurf für Anna Schmidt (Jahresabrechnung 2025)...");
  await erstelleRechnungsentwurf({
    mietparteiId: annaMietpartei.id,
    typ: "JAHRESABRECHNUNG",
    von: new Date("2025-01-01T00:00:00.000Z"),
    bis: new Date("2025-12-31T23:59:59.000Z"),
  });

  console.log("\nFertig! Login-Daten für die Demo (Passwort jeweils, s.u.):");
  console.log(`  Passwort für alle Demo-Zugänge: ${DEMO_PASSWORD}`);
  console.log("  Admin:            admin");
  console.log("  Mieterin (Olfen): anna.schmidt");
  console.log("  Mieter (Olfen):   peter.klein");
  console.log("  Mieter (Köln):    familie.yilmaz");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
