"use client";

import { useState } from "react";

/**
 * Anrede der Vermieter:in (Firma/Herr/Frau) + optionaler Firmenname (nur bei
 * Anrede „Firma") sowie – für ein Vermieter-Ehepaar/-Duo – die Anrede der
 * zweiten Vermieter:in (zum zweiten Namen aus ZweiterNameFeld). Wird in den
 * Objekt- und Einheit-Formularen unter dem Vermieter-Namen eingebunden; steuert
 * im Anschreiben die Formulierung „Ihrem Vermieter"/„Ihrer Vermieterin"/„der {Firma}"
 * (bei zwei Vermieter:innen je eigene Anrede).
 */
export function VermieterAnredeFirma({
  anredeDefault = "",
  anrede2Default = "",
  firmaDefault = "",
  idPrefix = "",
}: {
  anredeDefault?: string;
  anrede2Default?: string;
  firmaDefault?: string;
  idPrefix?: string;
}) {
  const [anrede, setAnrede] = useState(anredeDefault);
  const anredeId = `${idPrefix}vermieterAnrede`;
  const anrede2Id = `${idPrefix}vermieterAnrede2`;
  const firmaId = `${idPrefix}vermieterFirma`;
  return (
    <>
      <div className="field">
        <label htmlFor={anredeId}>Vermieter:in – Anrede</label>
        <select
          id={anredeId}
          name="vermieterAnrede"
          className="select-inline"
          value={anrede}
          onChange={(e) => setAnrede(e.target.value)}
        >
          <option value="">— keine —</option>
          <option value="HERR">Herr</option>
          <option value="FRAU">Frau</option>
          <option value="FIRMA">Firma</option>
        </select>
      </div>
      {anrede === "FIRMA" && (
        <div className="field">
          <label htmlFor={firmaId}>Vermieter:in – Firma</label>
          <input id={firmaId} name="vermieterFirma" type="text" defaultValue={firmaDefault} />
        </div>
      )}
      {/* Anrede der optionalen zweiten Vermieter:in (nur relevant bei zweitem Namen). */}
      {anrede !== "FIRMA" && (
        <div className="field">
          <label htmlFor={anrede2Id}>Zweite:r Vermieter:in – Anrede</label>
          <select id={anrede2Id} name="vermieterAnrede2" className="select-inline" defaultValue={anrede2Default}>
            <option value="">— keine —</option>
            <option value="HERR">Herr</option>
            <option value="FRAU">Frau</option>
          </select>
        </div>
      )}
    </>
  );
}
