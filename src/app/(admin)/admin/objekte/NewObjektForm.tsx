"use client";

import { useActionState } from "react";
import { createObjektAction, type ObjektFormState } from "./actions";

const initialState: ObjektFormState = {};

export function NewObjektForm() {
  const [state, formAction, pending] = useActionState(createObjektAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required placeholder="Köln-Buchforst" />
        </div>
        <div className="field">
          <label htmlFor="adresse">Adresse</label>
          <input id="adresse" name="adresse" type="text" required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Objekt anlegen"}
      </button>
    </form>
  );
}
