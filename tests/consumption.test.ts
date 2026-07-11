import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { verbrauchKwhFuerEinheit, zaehlerstaendeFuerEinheit } from "@/lib/billing/consumption";

describe("verbrauchKwhFuerEinheit", () => {
  const suffix = crypto.randomUUID();
  let objektId: string;
  let einheitId: string;

  beforeAll(async () => {
    const objekt = await prisma.objekt.create({
      data: { name: `Test-Objekt-${suffix}`, adresse: "Teststraße 1" },
    });
    objektId = objekt.id;
    const einheit = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit" } });
    einheitId = einheit.id;
  });

  afterAll(async () => {
    await prisma.objekt.delete({ where: { id: objektId } }); // kaskadiert Einheiten/Geraete/Zuordnungen/Messwerte
    await prisma.$disconnect();
  });

  it("berechnet den Verbrauch aus der Differenz zweier Zählerstände (mehrere Phasen summiert)", async () => {
    const geraet = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-1`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Pro 3EM Test" },
    });
    await prisma.geraetZuordnung.create({
      data: { einheitId, shellyGeraetId: geraet.id, modus: "ADDIEREN" },
    });

    const von = new Date("2026-01-01T00:00:00.000Z");
    const bis = new Date("2026-01-31T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: geraet.id, phase: "a", timestamp: von, energyWh: 1000 },
        { geraetId: geraet.id, phase: "a", timestamp: bis, energyWh: 1500 },
        { geraetId: geraet.id, phase: "b", timestamp: von, energyWh: 2000 },
        { geraetId: geraet.id, phase: "b", timestamp: bis, energyWh: 2800 },
      ],
    });

    const verbrauch = await verbrauchKwhFuerEinheit(einheitId, { von, bis });
    // (1500-1000) + (2800-2000) = 500 + 800 = 1300 Wh = 1.3 kWh
    expect(verbrauch).toBeCloseTo(1.3, 3);
  });

  it("summiert den Verbrauch mehrerer Geräte derselben Einheit (mehrere Shellys pro Mieter)", async () => {
    const einheit2 = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit 2" } });

    const geraetA = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-a`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Gerät A" },
    });
    const geraetB = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-b`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Gerät B" },
    });
    await prisma.geraetZuordnung.createMany({
      data: [
        { einheitId: einheit2.id, shellyGeraetId: geraetA.id, modus: "ADDIEREN" },
        { einheitId: einheit2.id, shellyGeraetId: geraetB.id, modus: "ADDIEREN" },
      ],
    });

    const von = new Date("2026-02-01T00:00:00.000Z");
    const bis = new Date("2026-02-28T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: geraetA.id, phase: "a", timestamp: von, energyWh: 100 },
        { geraetId: geraetA.id, phase: "a", timestamp: bis, energyWh: 600 }, // 500 Wh
        { geraetId: geraetB.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: geraetB.id, phase: "a", timestamp: bis, energyWh: 300 }, // 300 Wh
      ],
    });

    const verbrauch = await verbrauchKwhFuerEinheit(einheit2.id, { von, bis });
    expect(verbrauch).toBeCloseTo(0.8, 3); // 500 + 300 = 800 Wh
  });

  it("zieht einen als SUBTRAHIEREN zugeordneten Allgemeinstrom-Zwischenzähler vom Verbrauch ab", async () => {
    const einheit4 = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit 4" } });
    const hauptzaehler = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-haupt`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Mieterzähler" },
    });
    const allgemeinstrom = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-allg`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Allgemeinstrom" },
    });

    await prisma.geraetZuordnung.createMany({
      data: [
        { einheitId: einheit4.id, shellyGeraetId: hauptzaehler.id, modus: "ADDIEREN" },
        { einheitId: einheit4.id, shellyGeraetId: allgemeinstrom.id, modus: "SUBTRAHIEREN" },
      ],
    });

    const von = new Date("2026-04-01T00:00:00.000Z");
    const bis = new Date("2026-04-30T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: hauptzaehler.id, phase: "a", timestamp: von, energyWh: 1000 },
        { geraetId: hauptzaehler.id, phase: "a", timestamp: bis, energyWh: 2000 }, // 1000 Wh gesamt
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: von, energyWh: 100 },
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: bis, energyWh: 300 }, // 200 Wh Allgemeinstrom-Anteil
      ],
    });

    const verbrauch = await verbrauchKwhFuerEinheit(einheit4.id, { von, bis });
    expect(verbrauch).toBeCloseTo(0.8, 3); // 1000 - 200 = 800 Wh
  });

  it("teilt einen gemeinsamen Allgemeinstrom-Zähler korrekt auf mehrere Einheiten auf (Subtraktion bei jeder)", async () => {
    const einheitX = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit X" } });
    const einheitY = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit Y" } });

    const zaehlerX = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-x`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Zähler X" },
    });
    const zaehlerY = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-y`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Zähler Y" },
    });
    const gemeinsamerAllgemeinstrom = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-shared`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Gemeinsamer Allgemeinstrom" },
    });

    await prisma.geraetZuordnung.createMany({
      data: [
        { einheitId: einheitX.id, shellyGeraetId: zaehlerX.id, modus: "ADDIEREN" },
        { einheitId: einheitX.id, shellyGeraetId: gemeinsamerAllgemeinstrom.id, modus: "SUBTRAHIEREN" },
        { einheitId: einheitY.id, shellyGeraetId: zaehlerY.id, modus: "ADDIEREN" },
        { einheitId: einheitY.id, shellyGeraetId: gemeinsamerAllgemeinstrom.id, modus: "SUBTRAHIEREN" },
      ],
    });

    const von = new Date("2026-05-01T00:00:00.000Z");
    const bis = new Date("2026-05-31T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: zaehlerX.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: zaehlerX.id, phase: "a", timestamp: bis, energyWh: 900 },
        { geraetId: zaehlerY.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: zaehlerY.id, phase: "a", timestamp: bis, energyWh: 700 },
        { geraetId: gemeinsamerAllgemeinstrom.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: gemeinsamerAllgemeinstrom.id, phase: "a", timestamp: bis, energyWh: 100 },
      ],
    });

    const verbrauchX = await verbrauchKwhFuerEinheit(einheitX.id, { von, bis });
    const verbrauchY = await verbrauchKwhFuerEinheit(einheitY.id, { von, bis });
    expect(verbrauchX).toBeCloseTo(0.8, 3); // 900 - 100 = 800 Wh
    expect(verbrauchY).toBeCloseTo(0.6, 3); // 700 - 100 = 600 Wh
  });

  it("schneidet das Ergebnis bei 0 ab, falls die Subtraktion rechnerisch negativ würde", async () => {
    const einheit5 = await prisma.einheit.create({ data: { objektId, bezeichnung: "Testeinheit 5" } });
    const hauptzaehler = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-neg-haupt`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Zähler" },
    });
    const allgemeinstrom = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-neg-allg`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Allgemeinstrom" },
    });

    await prisma.geraetZuordnung.createMany({
      data: [
        { einheitId: einheit5.id, shellyGeraetId: hauptzaehler.id, modus: "ADDIEREN" },
        { einheitId: einheit5.id, shellyGeraetId: allgemeinstrom.id, modus: "SUBTRAHIEREN" },
      ],
    });

    const von = new Date("2026-06-01T00:00:00.000Z");
    const bis = new Date("2026-06-30T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: hauptzaehler.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: hauptzaehler.id, phase: "a", timestamp: bis, energyWh: 100 },
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: von, energyWh: 0 },
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: bis, energyWh: 500 }, // größer als Hauptzähler
      ],
    });

    const verbrauch = await verbrauchKwhFuerEinheit(einheit5.id, { von, bis });
    expect(verbrauch).toBe(0);
  });
});

describe("zaehlerstaendeFuerEinheit", () => {
  const suffix = crypto.randomUUID();
  let objektId: string;

  beforeAll(async () => {
    const objekt = await prisma.objekt.create({
      data: { name: `Test-Objekt-Zaehlerstand-${suffix}`, adresse: "Teststraße 1" },
    });
    objektId = objekt.id;
  });

  afterAll(async () => {
    await prisma.objekt.delete({ where: { id: objektId } });
    await prisma.$disconnect();
  });

  it("liefert Anfangs- und Endzählerstand, deren Differenz dem Verbrauch entspricht (einfacher Fall)", async () => {
    const einheit = await prisma.einheit.create({ data: { objektId, bezeichnung: "Whg. Zählerstand 1" } });
    const geraet = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-z1`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Zähler" },
    });
    await prisma.geraetZuordnung.create({
      data: { einheitId: einheit.id, shellyGeraetId: geraet.id, modus: "ADDIEREN" },
    });

    const von = new Date("2026-01-01T00:00:00.000Z");
    const bis = new Date("2026-01-31T23:59:59.000Z");
    await prisma.messwert.createMany({
      data: [
        { geraetId: geraet.id, phase: "a", timestamp: von, energyWh: 1000 },
        { geraetId: geraet.id, phase: "a", timestamp: bis, energyWh: 1500 },
      ],
    });

    const { anfangKwh, endeKwh } = await zaehlerstaendeFuerEinheit(einheit.id, { von, bis });
    const verbrauch = await verbrauchKwhFuerEinheit(einheit.id, { von, bis });

    expect(anfangKwh).toBeCloseTo(1.0, 3);
    expect(endeKwh).toBeCloseTo(1.5, 3);
    expect(endeKwh - anfangKwh).toBeCloseTo(verbrauch, 3);
  });

  it("bildet bei Allgemeinstrom-Subtraktion einen konsistenten aggregierten Zählerstand (Endstand - Anfangsstand = Verbrauch)", async () => {
    const einheit = await prisma.einheit.create({ data: { objektId, bezeichnung: "Whg. Zählerstand 2" } });
    const hauptzaehler = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-z2-haupt`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Mieterzähler" },
    });
    const allgemeinstrom = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-z2-allg`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Allgemeinstrom" },
    });
    await prisma.geraetZuordnung.createMany({
      data: [
        { einheitId: einheit.id, shellyGeraetId: hauptzaehler.id, modus: "ADDIEREN" },
        { einheitId: einheit.id, shellyGeraetId: allgemeinstrom.id, modus: "SUBTRAHIEREN" },
      ],
    });

    const von = new Date("2026-04-01T00:00:00.000Z");
    const bis = new Date("2026-04-30T23:59:59.000Z");
    await prisma.messwert.createMany({
      data: [
        { geraetId: hauptzaehler.id, phase: "a", timestamp: von, energyWh: 1000 },
        { geraetId: hauptzaehler.id, phase: "a", timestamp: bis, energyWh: 2000 },
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: von, energyWh: 100 },
        { geraetId: allgemeinstrom.id, phase: "a", timestamp: bis, energyWh: 300 },
      ],
    });

    const { anfangKwh, endeKwh } = await zaehlerstaendeFuerEinheit(einheit.id, { von, bis });
    const verbrauch = await verbrauchKwhFuerEinheit(einheit.id, { von, bis });

    // Anfang: 1000 - 100 = 900 Wh = 0.9 kWh; Ende: 2000 - 300 = 1700 Wh = 1.7 kWh
    expect(anfangKwh).toBeCloseTo(0.9, 3);
    expect(endeKwh).toBeCloseTo(1.7, 3);
    expect(endeKwh - anfangKwh).toBeCloseTo(verbrauch, 3); // 0.8 kWh
  });

  it("schätzt den Endzählerstand bei fehlendem Monatsend-Wert und markiert dies", async () => {
    const einheit = await prisma.einheit.create({ data: { objektId, bezeichnung: "Whg. Schätzung" } });
    const geraet = await prisma.shellyGeraet.create({
      data: { objektId, deviceId: `dev-${suffix}-schaetz`, serverHost: "shelly-test.shelly.cloud", bezeichnung: "Zähler" },
    });
    await prisma.geraetZuordnung.create({
      data: { einheitId: einheit.id, shellyGeraetId: geraet.id, modus: "ADDIEREN" },
    });

    const von = new Date("2027-01-01T00:00:00.000Z");
    const bis = new Date("2027-01-31T23:59:59.000Z");

    await prisma.messwert.createMany({
      data: [
        { geraetId: geraet.id, phase: "a", timestamp: von, energyWh: 1000 },
        // letzter Wert vor Monatsende liegt Mitte Januar (grosse Luecke bis bis)
        { geraetId: geraet.id, phase: "a", timestamp: new Date("2027-01-15T00:00:00.000Z"), energyWh: 1500 },
        // erst im Folgemonat wieder Daten
        { geraetId: geraet.id, phase: "a", timestamp: new Date("2027-02-10T00:00:00.000Z"), energyWh: 2500 },
      ],
    });

    const { anfangKwh, endeKwh, geschaetzt } = await zaehlerstaendeFuerEinheit(einheit.id, { von, bis });
    expect(geschaetzt).toBe(true);
    expect(anfangKwh).toBeCloseTo(1.0, 3); // Anfang exakt vorhanden
    // Ende zwischen dem Mitte-Januar-Wert (1.5) und dem Februar-Wert (2.5) interpoliert
    expect(endeKwh).toBeGreaterThan(1.5);
    expect(endeKwh).toBeLessThan(2.5);
  });
});
