"use client";

import { useState } from "react";

/**
 * Objekt-Zusatzfelder: Zählernummer des öffentlichen Zählers, optionale
 * Hausverwaltung und die Auswahl, wer die Ergänzung zum Mietvertrag
 * unterschreibt (Vermieter:in oder Hausverwaltung). Wird in den Objekt-
 * Formularen eingebunden.
 */
export function ObjektZusatzFelder({
  oeffentlicherZaehler = "",
  hausverwaltungName = "",
  hausverwaltungAnschrift = "",
  hausverwaltungPlz = "",
  hausverwaltungOrt = "",
  ergaenzungUnterzeichner = "VERMIETER",
}: {
  oeffentlicherZaehler?: string;
  hausverwaltungName?: string;
  hausverwaltungAnschrift?: string;
  hausverwaltungPlz?: string;
  hausverwaltungOrt?: string;
  ergaenzungUnterzeichner?: string;
}) {
  const [hvName, setHvName] = useState(hausverwaltungName);
  const hatHv = hvName.trim().length > 0;

  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="oeffentlicherZaehler">Zählernummer öffentlicher Zähler (zum Netz)</label>
          <input
            id="oeffentlicherZaehler"
            name="oeffentlicherZaehler"
            type="text"
            defaultValue={oeffentlicherZaehler}
          />
        </div>
      </div>

      <h3 style={{ marginBottom: "0.4rem" }}>Hausverwaltung (optional)</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="hausverwaltungName">Hausverwaltung – Name</label>
          <input
            id="hausverwaltungName"
            name="hausverwaltungName"
            type="text"
            value={hvName}
            onChange={(e) => setHvName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="hausverwaltungAnschrift">Hausverwaltung – Straße &amp; Hausnr.</label>
          <input
            id="hausverwaltungAnschrift"
            name="hausverwaltungAnschrift"
            type="text"
            defaultValue={hausverwaltungAnschrift}
          />
        </div>
        <div className="field">
          <label htmlFor="hausverwaltungPlz">Hausverwaltung – PLZ</label>
          <input id="hausverwaltungPlz" name="hausverwaltungPlz" type="text" defaultValue={hausverwaltungPlz} />
        </div>
        <div className="field">
          <label htmlFor="hausverwaltungOrt">Hausverwaltung – Ort</label>
          <input id="hausverwaltungOrt" name="hausverwaltungOrt" type="text" defaultValue={hausverwaltungOrt} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ergaenzungUnterzeichner">Ergänzung zum Mietvertrag unterschreibt</label>
        <select
          id="ergaenzungUnterzeichner"
          name="ergaenzungUnterzeichner"
          className="select-inline"
          defaultValue={ergaenzungUnterzeichner}
        >
          <option value="VERMIETER">Vermieter:in</option>
          <option value="HAUSVERWALTUNG" disabled={!hatHv}>
            Hausverwaltung{hatHv ? "" : " (erst Name eintragen)"}
          </option>
        </select>
      </div>
    </>
  );
}
