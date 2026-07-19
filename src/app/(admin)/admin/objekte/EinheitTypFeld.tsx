"use client";

import { type EinheitTyp } from "./einheitTyp";

export type { EinheitTyp };

/**
 * Auswahl des Einheiten-Typs (Wohneinheit / Allgemeinstrom / Wärmepumpe).
 * Für Allgemeinstrom/Wärmepumpe entfällt die Mietvertrags-Ergänzung; Partei ist
 * i. d. R. der Vermieter (eigenständiger Stromliefervertrag).
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
        <option value="WAERMEPUMPE">Wärmepumpe</option>
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
