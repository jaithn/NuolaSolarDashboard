import { describe, it, expect } from "vitest";
import {
  mietparteiAnzeigeName,
  anredeSatz,
  empfaengerAnredeKurz,
  kombiniereNamen,
} from "../src/lib/mietpartei";

describe("mietparteiAnzeigeName – zweite Person", () => {
  it("zeigt eine Einzelperson wie bisher", () => {
    expect(mietparteiAnzeigeName({ vorname: "Peter", name: "Klein" })).toBe("Peter Klein");
  });

  it("fasst gleichen Nachnamen zusammen: 'Vorname1 und Vorname2 Nachname'", () => {
    expect(
      mietparteiAnzeigeName({ vorname: "Peter", name: "Klein", vorname2: "Anna", name2: "Klein" }),
    ).toBe("Peter und Anna Klein");
  });

  it("nennt bei verschiedenem Nachnamen beide vollständig mit 'und'", () => {
    expect(
      mietparteiAnzeigeName({ vorname: "Peter", name: "Klein", vorname2: "Anna", name2: "Müller" }),
    ).toBe("Peter Klein und Anna Müller");
  });

  it("behandelt gleichen Nachnamen case-insensitiv", () => {
    expect(
      mietparteiAnzeigeName({ vorname: "Peter", name: "Klein", vorname2: "Anna", name2: "klein" }),
    ).toBe("Peter und Anna Klein");
  });

  it("nutzt für Firmen weiterhin den Firmennamen", () => {
    expect(mietparteiAnzeigeName({ firma: "Muster GmbH" })).toBe("Muster GmbH");
  });
});

describe("anredeSatz – zweite Person", () => {
  it("Einzelperson: 'Sehr geehrter Herr {Name}'", () => {
    expect(anredeSatz({ anrede: "HERR", name: "Klein" })).toBe("Sehr geehrter Herr Klein");
  });

  it("gleicher Nachname -> 'Sehr geehrte Familie {Nachname}'", () => {
    expect(
      anredeSatz({ anrede: "HERR", name: "Klein", anrede2: "FRAU", vorname2: "Anna", name2: "Klein" }),
    ).toBe("Sehr geehrte Familie Klein");
  });

  it("verschiedene Nachnamen -> getrennt, Damen zuerst, zweite kleingeschrieben", () => {
    expect(
      anredeSatz({ anrede: "HERR", name: "Klein", anrede2: "FRAU", vorname2: "Anna", name2: "Müller" }),
    ).toBe("Sehr geehrte Frau Müller, sehr geehrter Herr Klein");
  });

  it("Firma bleibt 'Sehr geehrte Damen und Herren'", () => {
    expect(anredeSatz({ anrede: "FIRMA", firma: "Muster GmbH" })).toBe("Sehr geehrte Damen und Herren");
  });
});

describe("empfaengerAnredeKurz", () => {
  it("gibt 'Familie' bei zwei Personen mit gleichem Nachnamen", () => {
    expect(empfaengerAnredeKurz({ anrede: "HERR", name: "Klein", vorname2: "Anna", name2: "Klein" })).toBe(
      "Familie",
    );
  });

  it("gibt sonst die Kurz-Anrede der ersten Person", () => {
    expect(empfaengerAnredeKurz({ anrede: "HERR", name: "Klein" })).toBe("Herr");
  });
});

describe("kombiniereNamen (Vermieter)", () => {
  it("verbindet zwei Namen mit 'und'", () => {
    expect(kombiniereNamen("Max Mustermann", "Erika Mustermann")).toBe("Max Mustermann und Erika Mustermann");
  });

  it("gibt bei nur einem Namen diesen zurück", () => {
    expect(kombiniereNamen("Max Mustermann", null)).toBe("Max Mustermann");
  });

  it("gibt null zurück, wenn kein Name gesetzt ist", () => {
    expect(kombiniereNamen("", "  ")).toBeNull();
  });
});
