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
}: {
  id: string;
  name: string;
  adresse: string;
  plz: string;
  ort: string;
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
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
