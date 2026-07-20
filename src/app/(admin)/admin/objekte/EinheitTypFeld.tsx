"use client";

import { type EinheitTyp } from "./einheitTyp";

export type { EinheitTyp };

/**
 * Auswahl des Einheiten-Typs (Wohneinheit / Gewerbeeinheit / Allgemeinstrom).
 * Für Allgemeinstrom entfällt die Mietvertrags-Ergänzung; Partei ist i. d. R. der
 * Vermieter (eigenständiger Stromliefervertrag). Den Typ „Wärmepumpe" gibt es
 * bewusst NICHT (mehr) als eigene Einheit: eine Wärmepumpe ist ein als solcher
 * markierter Zähler der Allgemeinstrom-Einheit (nur Allgemeinstrom ODER
 * Allgemeinstrom + Wärmepumpe). Der Enum-Wert WAERMEPUMPE bleibt nur für die
 * Anzeige evtl. bereits bestehender Alt-Einheiten erhalten.
 */
export function EinheitTypFeld({
  typ,
  onChange,
  idPrefix = "",
}: {
  typ: EinheitTyp;
  onChange: (t: EinheitTyp) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}typ`;
  return (
    <div className="field">
      <label htmlFor={id}>Typ</label>
      <select
        id={id}
        name="typ"
        className="select-inline"
        value={typ}
        onChange={(e) => onChange(e.target.value as EinheitTyp)}
      >
        <option value="WOHNEINHEIT">Wohneinheit</option>
        <option value="GEWERBEEINHEIT">Gewerbeeinheit</option>
        <option value="ALLGEMEINSTROM">Allgemeinstrom (Vermieter:in)</option>
        {/* Alt-Einheiten vom Typ Wärmepumpe weiterhin auswählbar halten, aber nicht neu anbieten. */}
        {typ === "WAERMEPUMPE" && <option value="WAERMEPUMPE">Wärmepumpe (veraltet)</option>}
      </select>
      {typ !== "WOHNEINHEIT" && typ !== "GEWERBEEINHEIT" && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>
          Keiner Miet-/Gewerbeeinheit zugeordnet, keine Ergänzung zum Mietvertrag. Die Partei (i. d. R. die
          Vermieter:in) erhält einen eigenständigen Stromliefervertrag.
        </p>
      )}
    </div>
  );
}
