"use client";

export type EinheitTyp = "WOHNEINHEIT" | "ALLGEMEINSTROM" | "WAERMEPUMPE";

/** Beschriftung der Einheiten-Typen für die Anzeige (Badges, Selects). */
export const EINHEIT_TYP_LABEL: Record<EinheitTyp, string> = {
  WOHNEINHEIT: "Wohneinheit",
  ALLGEMEINSTROM: "Allgemeinstrom",
  WAERMEPUMPE: "Wärmepumpe",
};

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
        <option value="ALLGEMEINSTROM">Allgemeinstrom (Vermieter:in)</option>
        <option value="WAERMEPUMPE">Wärmepumpe</option>
      </select>
      {typ !== "WOHNEINHEIT" && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>
          Keiner Wohnung zugeordnet, keine Ergänzung zum Mietvertrag. Die Partei (i. d. R. die
          Vermieter:in) erhält einen eigenständigen Stromliefervertrag.
        </p>
      )}
    </div>
  );
}
