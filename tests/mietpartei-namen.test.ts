import { describe, it, expect } from "vitest";
import {
  mietparteiAnzeigeName,
  anredeSatz,
  empfaengerAnredeKurz,
  kombiniereNamen,
  vermieterAnredePhrase,
  benutzernameBasis,
  darfMieterEinloggen,
} from "../src/lib/mietpartei";
import { verbrauchsstelleBezeichnung } from "../src/app/(admin)/admin/objekte/einheitTyp";

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

  it("zeigt bei Firma mit Ansprechpartner nur die Firma (Brief adressiert die Firma)", () => {
    expect(mietparteiAnzeigeName({ firma: "Muster GmbH", vorname: "Max", name: "Meier" })).toBe("Muster GmbH");
  });
});

describe("vermieterAnredePhrase", () => {
  it("Frau -> 'Ihrer Vermieterin {Name}'", () => {
    expect(vermieterAnredePhrase({ anrede: "FRAU", name: "Anna Müller" })).toBe("Ihrer Vermieterin Anna Müller");
  });
  it("Herr -> 'Ihrem Vermieter {Name}'", () => {
    expect(vermieterAnredePhrase({ anrede: "HERR", name: "Peter Klein" })).toBe("Ihrem Vermieter Peter Klein");
  });
  it("Firma -> 'der {Firma}'", () => {
    expect(vermieterAnredePhrase({ anrede: "FIRMA", firma: "Immo GmbH" })).toBe("der Immo GmbH");
  });
  it("ohne Anrede -> nur Name", () => {
    expect(vermieterAnredePhrase({ name: "Sabine Keller" })).toBe("Sabine Keller");
  });
  it("ohne alles -> neutraler Fallback", () => {
    expect(vermieterAnredePhrase({})).toBe("Ihrer Vermieterin bzw. Ihrem Vermieter");
  });
  it("zwei Vermieter:innen -> je eigene Anrede, mit 'und' verbunden", () => {
    expect(
      vermieterAnredePhrase({ anrede: "FRAU", name: "Anna Müller", anrede2: "HERR", name2: "Max Müller" }),
    ).toBe("Ihrer Vermieterin Anna Müller und Ihrem Vermieter Max Müller");
  });
  it("zweiter Vermieter ohne Anrede -> nur Name im zweiten Teil", () => {
    expect(vermieterAnredePhrase({ anrede: "HERR", name: "Peter Klein", name2: "Sabine Klein" })).toBe(
      "Ihrem Vermieter Peter Klein und Sabine Klein",
    );
  });
  it("Firma ignoriert zweite Person", () => {
    expect(vermieterAnredePhrase({ anrede: "FIRMA", firma: "Immo GmbH", name2: "Ignoriert" })).toBe("der Immo GmbH");
  });
});

describe("verbrauchsstelleBezeichnung", () => {
  it("Wohneinheit -> Wohnung", () => {
    expect(verbrauchsstelleBezeichnung("WOHNEINHEIT")).toBe("Wohnung");
  });
  it("Gewerbeeinheit -> Gewerbeeinheit", () => {
    expect(verbrauchsstelleBezeichnung("GEWERBEEINHEIT")).toBe("Gewerbeeinheit");
  });
  it("Allgemeinstrom -> Verbrauchsstelle", () => {
    expect(verbrauchsstelleBezeichnung("ALLGEMEINSTROM")).toBe("Verbrauchsstelle");
  });
});

describe("benutzernameBasis", () => {
  it("eine Person -> 'vorname-nachname'", () => {
    expect(benutzernameBasis({ vorname: "Denise", name: "Kosidis" })).toBe("denise-kosidis");
  });

  it("gleicher Nachname (Familie) -> Vorname der Hauptperson + Nachname", () => {
    expect(
      benutzernameBasis({
        vorname: "Roswitha",
        name: "Orlowski",
        weiterePersonen: [{ anrede: "HERR", vorname: "Claus-Dieter", name: "Orlowski" }],
      }),
    ).toBe("roswitha-orlowski");
  });

  it("verschiedene Nachnamen -> 'nachname1-nachname2'", () => {
    expect(
      benutzernameBasis({
        vorname: "Bianca",
        name: "Schönemann",
        weiterePersonen: [{ anrede: "HERR", vorname: "Marcel", name: "Orlowski" }],
      }),
    ).toBe("schonemann-orlowski");
  });

  it("drei verschiedene Nachnamen -> alle verbunden, Duplikate zusammengefasst", () => {
    expect(
      benutzernameBasis({
        vorname: "A",
        name: "Klein",
        weiterePersonen: [
          { anrede: "FRAU", vorname: "B", name: "Müller" },
          { anrede: "HERR", vorname: "C", name: "Klein" },
        ],
      }),
    ).toBe("klein-muller");
  });

  it("Umlaute/ß werden vereinfacht (ä→a, ö→o, ü→u, ß→ss)", () => {
    expect(benutzernameBasis({ vorname: "Jürgen", name: "Weiß" })).toBe("jurgen-weiss");
  });

  it("reine Firma -> Slug des Firmennamens", () => {
    expect(benutzernameBasis({ firma: "OneBet Sportwetten GmbH" })).toBe("onebetsportwettengmbh");
  });

  it("ohne verwertbare Namen -> 'mieter'", () => {
    expect(benutzernameBasis({})).toBe("mieter");
  });
});

describe("darfMieterEinloggen", () => {
  const heute = new Date("2026-07-21T12:00:00Z");

  it("AKTIV mit zukünftigem Einzug -> Login erlaubt (anders als isMietparteiEffectivelyAktiv)", () => {
    expect(
      darfMieterEinloggen(
        { status: "AKTIV", einzugsdatum: new Date("2026-08-15"), auszugsdatum: null },
        heute,
      ),
    ).toBe(true);
  });

  it("Status INTERESSENT -> Login gesperrt", () => {
    expect(
      darfMieterEinloggen(
        { status: "INTERESSENT", einzugsdatum: new Date("2026-01-01"), auszugsdatum: null },
        heute,
      ),
    ).toBe(false);
  });

  it("nach dem Auszug -> Login gesperrt", () => {
    expect(
      darfMieterEinloggen(
        { status: "AKTIV", einzugsdatum: new Date("2025-01-01"), auszugsdatum: new Date("2026-06-30") },
        heute,
      ),
    ).toBe(false);
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

describe("weiterePersonen (beliebig viele, JSON)", () => {
  it("drei Personen mit gleichem Nachnamen -> 'V1, V2 und V3 Nachname'", () => {
    expect(
      mietparteiAnzeigeName({
        vorname: "Peter",
        name: "Klein",
        weiterePersonen: [
          { anrede: "FRAU", vorname: "Anna", name: "Klein" },
          { anrede: "HERR", vorname: "Tim", name: "Klein" },
        ],
      }),
    ).toBe("Peter, Anna und Tim Klein");
  });

  it("drei Personen, gleicher Nachname -> Familienanrede", () => {
    expect(
      anredeSatz({
        anrede: "HERR",
        name: "Klein",
        weiterePersonen: [
          { anrede: "FRAU", vorname: "Anna", name: "Klein" },
          { anrede: "HERR", vorname: "Tim", name: "Klein" },
        ],
      }),
    ).toBe("Sehr geehrte Familie Klein");
  });

  it("drei Personen, verschiedene Nachnamen -> Damen zuerst, weitere kleingeschrieben", () => {
    expect(
      anredeSatz({
        anrede: "HERR",
        name: "Klein",
        weiterePersonen: [
          { anrede: "FRAU", vorname: "Anna", name: "Müller" },
          { anrede: "HERR", vorname: "Tim", name: "Schmidt" },
        ],
      }),
    ).toBe("Sehr geehrte Frau Müller, sehr geehrter Herr Klein, sehr geehrter Herr Schmidt");
  });

  it("weiterePersonen hat Vorrang vor Legacy vorname2/name2", () => {
    expect(
      mietparteiAnzeigeName({
        vorname: "Peter",
        name: "Klein",
        vorname2: "Legacy",
        name2: "Alt",
        weiterePersonen: [{ anrede: "FRAU", vorname: "Anna", name: "Klein" }],
      }),
    ).toBe("Peter und Anna Klein");
  });

  it("leeres weiterePersonen -> Legacy-Fallback greift", () => {
    expect(
      mietparteiAnzeigeName({
        vorname: "Peter",
        name: "Klein",
        vorname2: "Anna",
        name2: "Klein",
        weiterePersonen: [],
      }),
    ).toBe("Peter und Anna Klein");
  });

  it("Familienname bei mehreren Personen -> empfaengerAnredeKurz 'Familie'", () => {
    expect(
      empfaengerAnredeKurz({
        anrede: "HERR",
        name: "Klein",
        weiterePersonen: [{ anrede: "FRAU", vorname: "Anna", name: "Klein" }],
      }),
    ).toBe("Familie");
  });
});
