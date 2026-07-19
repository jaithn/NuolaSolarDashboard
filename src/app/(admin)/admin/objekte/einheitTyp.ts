// Reines (nicht-"use client") Modul: Typ + Beschriftung der Einheiten-Typen.
// Bewusst getrennt von EinheitTypFeld.tsx ("use client"), damit auch
// Server-Komponenten (z.B. die Objekt-Übersicht) die Beschriftung importieren
// können, ohne über die Client-Grenze zu gehen.

export type EinheitTyp = "WOHNEINHEIT" | "GEWERBEEINHEIT" | "ALLGEMEINSTROM" | "WAERMEPUMPE";

export const EINHEIT_TYP_LABEL: Record<EinheitTyp, string> = {
  WOHNEINHEIT: "Wohneinheit",
  GEWERBEEINHEIT: "Gewerbeeinheit",
  ALLGEMEINSTROM: "Allgemeinstrom",
  WAERMEPUMPE: "Wärmepumpe",
};

// Vermietbare Einheiten (echte Mietpartei mit Ergänzung zum Mietvertrag und je
// Einheit ggf. eigener Vermieter:in). Allgemeinstrom/Wärmepumpe sind Sonder-
// Einheiten (Partei i.d.R. die Vermieter:in, eigenständiger Vertrag, keine
// Ergänzung).
export function istVermietbareEinheit(typ: EinheitTyp): boolean {
  return typ === "WOHNEINHEIT" || typ === "GEWERBEEINHEIT";
}

/**
 * Bezeichnung der Verbrauchsstelle je Einheiten-Typ – für Brieftexte, z.B.
 * „…einen geeichten, Ihrer {Bezeichnung} eindeutig zugeordneten Stromzähler…".
 * Alle Werte sind grammatisch feminin (Artikel „Ihrer").
 */
export function verbrauchsstelleBezeichnung(typ: EinheitTyp): string {
  switch (typ) {
    case "WOHNEINHEIT":
      return "Wohnung";
    case "GEWERBEEINHEIT":
      return "Gewerbeeinheit";
    case "WAERMEPUMPE":
      return "Wärmepumpe";
    case "ALLGEMEINSTROM":
    default:
      return "Verbrauchsstelle";
  }
}
