"use client";

import { useActionState } from "react";
import { updateEinheitAction, type ObjektFormState } from "../../objekte/actions";

const initialState: ObjektFormState = {};

export function EditEinheitForm({ id, bezeichnung }: { id: string; bezeichnung: string }) {
  const [state, formAction, pending] = useActionState(updateEinheitAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung der Einheit</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required defaultValue={bezeichnung} />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
