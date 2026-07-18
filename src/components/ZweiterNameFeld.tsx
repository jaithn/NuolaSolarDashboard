"use client";

import { useState } from "react";

/**
 * Optionales zweites Namensfeld mit Button „+ Zweiter Name". Wird u. a. beim
 * Vermieter genutzt, damit ein zweiter Name (z. B. Eigentümer-Ehepaar) nur bei
 * Bedarf eingeblendet wird. Der Wert wird als `name` (Default: "vermieterName2")
 * gesendet; bei vorhandenem Default-Wert (Bearbeiten) ist das Feld direkt sichtbar.
 */
export function ZweiterNameFeld({
  name = "vermieterName2",
  id,
  label = "Zweiter Name",
  buttonLabel = "+ Zweiter Name",
  defaultValue = "",
}: {
  name?: string;
  id?: string;
  label?: string;
  buttonLabel?: string;
  defaultValue?: string;
}) {
  const feldId = id ?? name;
  const [offen, setOffen] = useState(Boolean(defaultValue?.trim()));

  if (!offen) {
    return (
      <button type="button" className="btn-small" style={{ marginTop: "0.4rem" }} onClick={() => setOffen(true)}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="field" style={{ marginTop: "0.4rem" }}>
      <label htmlFor={feldId}>{label}</label>
      <input id={feldId} name={name} type="text" defaultValue={defaultValue} />
      <button
        type="button"
        className="btn-small btn-danger"
        style={{ marginTop: "0.4rem" }}
        onClick={() => setOffen(false)}
      >
        Entfernen
      </button>
    </div>
  );
}
