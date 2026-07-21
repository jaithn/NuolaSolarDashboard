import { describe, it, expect } from "vitest";
import { parseAusblick, ausblickFuerPdf } from "../src/lib/billing/ausblick";

// Steuersätze für die Brutto-Umrechnung (19 % / 7 %).
const prozentsatzFuer = (id: string): number | null => (id === "s19" ? 19 : id === "s7" ? 7 : null);

describe("parseAusblick", () => {
  it("liefert null bei fehlenden/leeren Daten", () => {
    expect(parseAusblick(null)).toBeNull();
    expect(parseAusblick({})).toBeNull();
    expect(parseAusblick({ gueltigAb: "2026-01-01" })).toBeNull(); // weder Preis noch Abschlag
  });

  it("parst reine Preisänderung (ohne Grundpreis)", () => {
    const a = parseAusblick({
      gueltigAb: "2026-01-01",
      preis: { arbeitspreisNetto: 0.35, arbeitspreisSteuersatzId: "s19", grundpreisNetto: null, grundpreisSteuersatzId: null, grund: "Netzentgelte" },
    });
    expect(a).not.toBeNull();
    expect(a!.preis?.arbeitspreisNetto).toBe(0.35);
    expect(a!.preis?.grundpreisNetto).toBeNull();
    expect(a!.abschlag).toBeNull();
  });

  it("parst reinen neuen Abschlag", () => {
    const a = parseAusblick({ gueltigAb: "2026-01-01", abschlag: { bruttoBetrag: 80, steuersatzId: "s19" } });
    expect(a!.preis).toBeNull();
    expect(a!.abschlag?.bruttoBetrag).toBe(80);
  });

  it("parst beide Fälle zusammen", () => {
    const a = parseAusblick({
      gueltigAb: "2026-01-01",
      preis: { arbeitspreisNetto: 0.35, arbeitspreisSteuersatzId: "s19", grundpreisNetto: 8, grundpreisSteuersatzId: "s19", grund: "x" },
      abschlag: { bruttoBetrag: 80, steuersatzId: "s19" },
    });
    expect(a!.preis?.grundpreisNetto).toBe(8);
    expect(a!.abschlag?.bruttoBetrag).toBe(80);
  });
});

describe("ausblickFuerPdf", () => {
  it("rechnet Netto-Preise korrekt in Brutto um", () => {
    const pdf = ausblickFuerPdf(
      {
        gueltigAb: "2026-01-01",
        preis: { arbeitspreisNetto: 0.3, arbeitspreisSteuersatzId: "s19", grundpreisNetto: 10, grundpreisSteuersatzId: "s19", grund: "x" },
        abschlag: { bruttoBetrag: 80, steuersatzId: "s19" },
      },
      prozentsatzFuer,
    );
    // 0,30 netto * 1,19 = 0,357 -> berechneBrutto rundet (wie in der ganzen App)
    // auf Cent -> 0,36.
    expect(pdf.preis?.arbeitspreisBrutto).toBe(0.36);
    // 10 netto * 1,19 = 11,90
    expect(pdf.preis?.grundpreisBrutto).toBeCloseTo(11.9, 2);
    // Abschlag ist bereits brutto
    expect(pdf.abschlagBrutto).toBe(80);
    expect(pdf.gueltigAb).toBeInstanceOf(Date);
  });

  it("lässt den Grundpreis weg, wenn keiner gesetzt ist", () => {
    const pdf = ausblickFuerPdf(
      { gueltigAb: "2026-01-01", preis: { arbeitspreisNetto: 0.3, arbeitspreisSteuersatzId: "s19", grundpreisNetto: null, grundpreisSteuersatzId: null, grund: "x" }, abschlag: null },
      prozentsatzFuer,
    );
    expect(pdf.preis?.grundpreisBrutto).toBeNull();
    expect(pdf.abschlagBrutto).toBeNull();
  });
});
