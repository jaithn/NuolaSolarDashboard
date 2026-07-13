"use client";

import { useActionState } from "react";
import { updateObjektAction, type ObjektFormState } from "../actions";

const initialState: ObjektFormState = {};

export function EditObjektForm({
  id,
  name,
  adresse,
  plz,
  ort,
  vermieterName,
  vermieterAnschrift,
}: {
  id: string;
  name: string;
  adresse: string;
  plz: string;
  ort: string;
  vermieterName: string | null;
  vermieterAnschrift: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateObjektAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" defaultValue={name} required />
        </div>
        <div className="field">
          <label htmlFor="adresse">Straße &amp; Hausnummer</label>
          <input id="adresse" name="adresse" type="text" defaultValue={adresse} required />
        </div>
        <div className="field">
          <label htmlFor="plz">PLZ</label>
          <input id="plz" name="plz" type="text" defaultValue={plz} required inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="ort">Ort</label>
          <input id="ort" name="ort" type="text" defaultValue={ort} required />
        </div>
        <div className="field">
          <label htmlFor="vermieterName">Vermieter (Name)</label>
          <input id="vermieterName" name="vermieterName" type="text" defaultValue={vermieterName ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="vermieterAnschrift">Vermieter (Anschrift)</label>
          <input
            id="vermieterAnschrift"
            name="vermieterAnschrift"
            type="text"
            defaultValue={vermieterAnschrift ?? ""}
          />
        </div>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Der Vermieter wird nur für die „Ergänzung zum Mietvertrag" benötigt (dort ist er Vertragspartner).
      </p>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
