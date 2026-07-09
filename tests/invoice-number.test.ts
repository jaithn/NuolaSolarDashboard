import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { vergibNaechsteRechnungsnummer } from "@/lib/billing/invoiceNumber";

// Eigenes Testjahr, das kein anderer Test verwendet, um Interferenzen zu vermeiden.
const TEST_JAHR = 2999;

describe("vergibNaechsteRechnungsnummer", () => {
  afterAll(async () => {
    await prisma.rechnungsnummernZaehler.deleteMany({ where: { jahr: TEST_JAHR } });
    await prisma.$disconnect();
  });

  it("vergibt fortlaufende, lückenlose Nummern", async () => {
    const n1 = await vergibNaechsteRechnungsnummer(TEST_JAHR);
    const n2 = await vergibNaechsteRechnungsnummer(TEST_JAHR);
    const n3 = await vergibNaechsteRechnungsnummer(TEST_JAHR);

    expect(n1).toBe(`NUOLA-${TEST_JAHR}-0001`);
    expect(n2).toBe(`NUOLA-${TEST_JAHR}-0002`);
    expect(n3).toBe(`NUOLA-${TEST_JAHR}-0003`);
  });

  it("vergibt bei parallelen Aufrufen jede Nummer genau einmal (keine Duplikate)", async () => {
    const ergebnisse = await Promise.all(
      Array.from({ length: 10 }, () => vergibNaechsteRechnungsnummer(TEST_JAHR)),
    );
    const eindeutige = new Set(ergebnisse);
    expect(eindeutige.size).toBe(10);
  });
});
