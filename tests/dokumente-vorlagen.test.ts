import { describe, expect, it } from "vitest";
import {
  parseFrontMatter,
  parseAbschnitte,
  abschnitt,
  abschnittZeilen,
  ersetzePlatzhalter,
} from "@/lib/dokumenteVorlagen";
import { parseMarkdownBloecke } from "@/lib/pdf/markdown";

describe("parseFrontMatter", () => {
  it("trennt Front-Matter und Rumpf", () => {
    const md = `---\nart: EIGENSTAENDIG\nversion: 1.0\ntitel: Stromliefervertrag\ngueltigAb: 2026-01-01\n---\n\n## 1. Abschnitt\n\nText.`;
    const { meta, body } = parseFrontMatter(md);
    expect(meta.art).toBe("EIGENSTAENDIG");
    expect(meta.version).toBe("1.0");
    expect(meta.titel).toBe("Stromliefervertrag");
    expect(meta.gueltigAb).toBe("2026-01-01");
    expect(body.startsWith("## 1. Abschnitt")).toBe(true);
  });

  it("gibt leeres Meta zurück, wenn kein Front-Matter vorhanden ist", () => {
    const { meta, body } = parseFrontMatter("Nur Text ohne Kopf.");
    expect(meta).toEqual({});
    expect(body).toBe("Nur Text ohne Kopf.");
  });

  it("entfernt Anführungszeichen um Werte", () => {
    const { meta } = parseFrontMatter(`---\nversion: "1.0"\n---\nX`);
    expect(meta.version).toBe("1.0");
  });
});

describe("parseAbschnitte", () => {
  const md = `# Titel\n\nBeschreibung mit \`## schluessel\` inline.\n\n## einleitung\n\nHallo {firma}.\n\n## punkte\n\n- eins\n- zwei\n`;

  it("liest benannte Abschnitte, ignoriert Präambel", () => {
    const map = parseAbschnitte(md);
    expect(map.get("einleitung")).toBe("Hallo {firma}.");
    expect(map.has("punkte")).toBe(true);
    // Der Inline-Code `## schluessel` in der Beschreibung ist KEIN Abschnitt.
    expect(map.has("schluessel")).toBe(false);
  });

  it("abschnitt ersetzt Platzhalter und nutzt Fallback", () => {
    const map = parseAbschnitte(md);
    expect(abschnitt(map, "einleitung", "Standard", { firma: "Nuola Solar GbR" })).toBe(
      "Hallo Nuola Solar GbR.",
    );
    expect(abschnitt(map, "fehlt", "Standardtext {firma}", { firma: "Nuola" })).toBe("Standardtext Nuola");
  });

  it("abschnittZeilen liefert Aufzählungspunkte bzw. Fallback", () => {
    const map = parseAbschnitte(md);
    expect(abschnittZeilen(map, "punkte", ["fallback"])).toEqual(["eins", "zwei"]);
    expect(abschnittZeilen(map, "fehlt", ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("ersetzePlatzhalter", () => {
  it("ersetzt bekannte Platzhalter, leert unbekannte", () => {
    expect(ersetzePlatzhalter("Hallo {name}, {gruss}", { name: "Welt" })).toBe("Hallo Welt, ");
  });
});

describe("parseMarkdownBloecke", () => {
  it("erkennt Überschriften, Absätze und Listen", () => {
    const md = `## § 1 Titel\n\nErster Absatz\nZeile zwei.\n\n- Punkt A\n- Punkt B\n\nLetzter Absatz.`;
    const bloecke = parseMarkdownBloecke(md);
    expect(bloecke[0]).toEqual({ typ: "h2", text: "§ 1 Titel" });
    expect(bloecke[1]).toEqual({ typ: "absatz", text: "Erster Absatz Zeile zwei." });
    expect(bloecke[2]).toEqual({ typ: "liste", items: ["Punkt A", "Punkt B"] });
    expect(bloecke[3]).toEqual({ typ: "absatz", text: "Letzter Absatz." });
  });
});
