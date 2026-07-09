"use client";

import { useActionState } from "react";
import { updateObjektAction, type ObjektFormState } from "../actions";

const initialState: ObjektFormState = {};

export function EditObjektForm({ id, name, adresse }: { id: string; name: string; adresse: string }) {
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
          <label htmlFor="adresse">Adresse</label>
          <input id="adresse" name="adresse" type="text" defaultValue={adresse} required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
