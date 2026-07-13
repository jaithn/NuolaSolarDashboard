"use client";

import { useActionState, useState } from "react";
import { createObjektAction, type ObjektFormState } from "./actions";

const initialState: ObjektFormState = {};

export function NewObjektForm() {
  const [state, formAction, pending] = useActionState(createObjektAction, initialState);
  const [modus, setModus] = useState<"PRO_OBJEKT" | "PRO_EINHEIT">("PRO_OBJEKT");

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required placeholder="Köln-Buchforst" />
        </div>
        <div className="field">
          <label htmlFor="adresse">Straße &amp; Hausnummer</label>
          <input id="adresse" name="adresse" type="text" required placeholder="Buchforstweg 5" />
        </div>
        <div className="field">
          <label htmlFor="plz">PLZ</label>
          <input id="plz" name="plz" type="text" required placeholder="51065" inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="ort">Ort</label>
          <input id="ort" name="ort" type="text" required placeholder="Köln" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="vermieterModus">Vermieter:in (für die Ergänzung zum Mietvertrag)</label>
        <select
          id="vermieterModus"
          name="vermieterModus"
          className="select-inline"
          value={modus}
          onChange={(e) => setModus(e.target.value as "PRO_OBJEKT" | "PRO_EINHEIT")}
        >
          <option value="PRO_OBJEKT">Ein:e Vermieter:in für das ganze Objekt</option>
          <option value="PRO_EINHEIT">Je Wohneinheit ein:e eigene:r Vermieter:in</option>
        </select>
      </div>

      {modus === "PRO_OBJEKT" ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="vermieterName">Vermieter:in (Name)</label>
            <input id="vermieterName" name="vermieterName" type="text" />
          </div>
          <div className="field">
            <label htmlFor="vermieterAnschrift">Vermieter:in (Anschrift)</label>
            <input id="vermieterAnschrift" name="vermieterAnschrift" type="text" />
          </div>
        </div>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Die/der Vermieter:in wird dann beim Anlegen jeder Wohneinheit erfasst.
        </p>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Objekt anlegen"}
      </button>
    </form>
  );
}
