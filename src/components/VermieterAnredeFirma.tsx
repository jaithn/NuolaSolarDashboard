"use client";

import { useState } from "react";

/**
 * Anrede der Vermieter:in (Firma/Herr/Frau) + optionaler Firmenname (nur bei
 * Anrede „Firma"). Wird in den Objekt- und Einheit-Formularen unter dem
 * Vermieter-Namen eingebunden; steuert im Anschreiben die Formulierung
 * „Ihrem Vermieter"/„Ihrer Vermieterin"/„der {Firma}".
 */
export function VermieterAnredeFirma({
  anredeDefault = "",
  firmaDefault = "",
  idPrefix = "",
}: {
  anredeDefault?: string;
  firmaDefault?: string;
  idPrefix?: string;
}) {
  const [anrede, setAnrede] = useState(anredeDefault);
  const anredeId = `${idPrefix}vermieterAnrede`;
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
    </>
  );
}
