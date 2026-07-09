"use client";

import { useActionState } from "react";
import { createEinheitAction } from "../actions";
import type { ObjektFormState } from "../actions";

const initialState: ObjektFormState = {};

export function NewEinheitForm({ objektId }: { objektId: string }) {
  const [state, formAction, pending] = useActionState(createEinheitAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="objektId" value={objektId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required placeholder="Wohnung 1.OG links" />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Einheit anlegen"}
      </button>
    </form>
  );
}
