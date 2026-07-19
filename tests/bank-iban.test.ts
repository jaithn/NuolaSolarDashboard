import { describe, it, expect } from "vitest";
import { normalisiereIban, istGueltigeIban, formatiereIban, bankAusIban } from "@/lib/bank/iban";

describe("normalisiereIban", () => {
  it("entfernt Leerzeichen und setzt Grossbuchstaben", () => {
    expect(normalisiereIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
  });
  it("leere Eingabe -> leerer String", () => {
    expect(normalisiereIban("")).toBe("");
    expect(normalisiereIban(null)).toBe("");
  });
});

describe("istGueltigeIban", () => {
  it("erkennt gueltige deutsche IBAN", () => {
    expect(istGueltigeIban("DE89 3704 0044 0532 0130 00")).toBe(true);
  });
  it("lehnt ungueltige Pruefsumme ab", () => {
    expect(istGueltigeIban("DE00370400440532013000")).toBe(false);
  });
  it("lehnt Unsinn/leere Eingabe ab", () => {
    expect(istGueltigeIban("keine-iban")).toBe(false);
    expect(istGueltigeIban("")).toBe(false);
  });
});

describe("formatiereIban", () => {
  it("gruppiert in 4er-Bloecke", () => {
    expect(formatiereIban("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});

describe("bankAusIban", () => {
  it("ermittelt Bankname + BIC aus gueltiger IBAN", () => {
    const info = bankAusIban("DE89370400440532013000");
    expect(info?.bankName).toContain("Commerzbank");
    expect(info?.bic).toBe("COBADEFFXXX");
  });
  it("null bei ungueltiger IBAN", () => {
    expect(bankAusIban("DE00370400440532013000")).toBeNull();
    expect(bankAusIban("")).toBeNull();
  });
});
