import { describe, expect, it } from "vitest";
import { ermittleTeilzeitraeume, splitteNachSteuersatz, tageZwischen } from "@/lib/billing/taxSplit";
import { getSteuersatzForDate, berechneBrutto } from "@/lib/steuer";

const steuersaetzeMitWechsel = [
  { id: "alt", prozentsatz: 16, gueltigAb: new Date("2020-07-01T00:00:00.000Z"), gueltigBis: new Date("2020-12-31T00:00:00.000Z") },
  { id: "neu", prozentsatz: 19, gueltigAb: new Date("2021-01-01T00:00:00.000Z"), gueltigBis: null },
];

describe("tageZwischen", () => {
  it("zählt inklusive Start- und Endtag", () => {
    expect(tageZwischen(new Date("2026-01-01"), new Date("2026-01-01"))).toBe(1);
    expect(tageZwischen(new Date("2026-01-01"), new Date("2026-01-31"))).toBe(31);
  });
});

describe("getSteuersatzForDate", () => {
  it("wählt den zum Datum gültigen Satz aus mehreren Sätzen", () => {
    expect(getSteuersatzForDate(steuersaetzeMitWechsel, new Date("2020-08-15"))?.id).toBe("alt");
    expect(getSteuersatzForDate(steuersaetzeMitWechsel, new Date("2021-03-01"))?.id).toBe("neu");
  });

  it("liefert undefined, wenn kein Satz das Datum abdeckt", () => {
    expect(getSteuersatzForDate(steuersaetzeMitWechsel, new Date("2019-01-01"))).toBeUndefined();
  });
});

describe("ermittleTeilzeitraeume", () => {
  it("liefert den gesamten Zeitraum unverändert, wenn kein Satzwechsel dazwischenliegt", () => {
    const teile = ermittleTeilzeitraeume(
      { von: new Date("2021-01-01"), bis: new Date("2021-12-31") },
      steuersaetzeMitWechsel,
    );
    expect(teile).toHaveLength(1);
  });

  it("splittet am Stichtag eines Satzwechsels innerhalb des Zeitraums", () => {
    // Start bewusst innerhalb der "alt"-Periode (ab 2020-07-01), damit im
    // Zeitraum GENAU EIN Satzwechsel liegt (zum 2021-01-01). Ein früherer Start
    // (z.B. 2020-06-01) würde zusätzlich den Beginn von "alt" (2020-07-01)
    // überschreiten und korrekterweise 3 Teilzeiträume ergeben.
    const teile = ermittleTeilzeitraeume(
      { von: new Date("2020-08-01"), bis: new Date("2021-06-30") },
      steuersaetzeMitWechsel,
    );
    expect(teile).toHaveLength(2);
    expect(teile[0]!.bis.toISOString()).toBe(new Date("2020-12-31").toISOString());
    expect(teile[1]!.von.toISOString()).toBe(new Date("2021-01-01").toISOString());
  });

  it("splittet an ALLEN Satz-Stichtagen im Zeitraum (mehrere Wechsel)", () => {
    // Zeitraum überschreitet den Beginn von "alt" (2020-07-01) UND "neu"
    // (2021-01-01) -> drei lückenlose Teilzeiträume (rechtlich korrekt).
    const teile = ermittleTeilzeitraeume(
      { von: new Date("2020-06-01"), bis: new Date("2021-06-30") },
      steuersaetzeMitWechsel,
    );
    expect(teile).toHaveLength(3);
    expect(teile[0]!.bis.toISOString()).toBe(new Date("2020-06-30").toISOString());
    expect(teile[1]!.von.toISOString()).toBe(new Date("2020-07-01").toISOString());
    expect(teile[1]!.bis.toISOString()).toBe(new Date("2020-12-31").toISOString());
    expect(teile[2]!.von.toISOString()).toBe(new Date("2021-01-01").toISOString());
  });
});

describe("splitteNachSteuersatz", () => {
  it("teilt den Netto-Betrag taggenau proportional auf und wendet je Teilzeitraum den korrekten Satz an", () => {
    // Zeitraum 01.01.-31.12.2021 liegt komplett nach dem Wechsel -> keine Aufteilung, ein Satz.
    const positionen = splitteNachSteuersatz("Stromverbrauch", 1200, {
      von: new Date("2021-01-01"),
      bis: new Date("2021-12-31"),
    }, steuersaetzeMitWechsel);
    expect(positionen).toHaveLength(1);
    expect(positionen[0]!.steuersatzId).toBe("neu");
    const erwartet = berechneBrutto(1200, 19);
    expect(positionen[0]!.bruttoBetrag).toBeCloseTo(erwartet.bruttoBetrag, 2);
  });

  it("splittet Jan-Jun / Jul-Dez korrekt, wenn der Satz zur Jahresmitte wechselt", () => {
    const wechselMitteJahr = [
      { id: "h1", prozentsatz: 16, gueltigAb: new Date("2020-01-01"), gueltigBis: new Date("2020-06-30") },
      { id: "h2", prozentsatz: 19, gueltigAb: new Date("2020-07-01"), gueltigBis: null },
    ];

    const positionen = splitteNachSteuersatz(
      "Stromverbrauch",
      3660, // glatt teilbar bei 366 Tagen (Schaltjahr 2020) für einfache Erwartungswerte
      { von: new Date("2020-01-01"), bis: new Date("2020-12-31") },
      wechselMitteJahr,
    );

    expect(positionen).toHaveLength(2);
    expect(positionen[0]!.steuersatzId).toBe("h1");
    expect(positionen[1]!.steuersatzId).toBe("h2");

    const summeNetto = positionen.reduce((s, p) => s + p.nettoBetrag, 0);
    expect(summeNetto).toBeCloseTo(3660, 1);
  });
});
