// Reines (nicht-"use client") Modul: Typ + Beschriftung der Einheiten-Typen.
// Bewusst getrennt von EinheitTypFeld.tsx ("use client"), damit auch
// Server-Komponenten (z.B. die Objekt-Übersicht) die Beschriftung importieren
// können, ohne über die Client-Grenze zu gehen.

export type EinheitTyp = "WOHNEINHEIT" | "ALLGEMEINSTROM" | "WAERMEPUMPE";

export const EINHEIT_TYP_LABEL: Record<EinheitTyp, string> = {
  WOHNEINHEIT: "Wohneinheit",
  ALLGEMEINSTROM: "Allgemeinstrom",
  WAERMEPUMPE: "Wärmepumpe",
};
