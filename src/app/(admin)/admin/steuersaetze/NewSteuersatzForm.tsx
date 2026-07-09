"use client";

import { useActionState } from "react";
import { createSteuersatzAction, type SteuersatzFormState } from "./actions";

const initialState: SteuersatzFormState = {};

export function NewSteuersatzForm() {
  const [state, formAction, pending] = useActionState(createSteuersatzAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required placeholder="Regulärer Steuersatz" />
        </div>
        <div className="field">
          <label htmlFor="prozentsatz">Prozentsatz</label>
          <input id="prozentsatz" name="prozentsatz" type="number" step="0.01" min={0} max={100} required />
        </div>
        <div className="field">
          <label htmlFor="gueltigAb">Gültig ab</label>
          <input id="gueltigAb" name="gueltigAb" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="gueltigBis">Gültig bis (optional)</label>
          <input id="gueltigBis" name="gueltigBis" type="date" />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Steuersatz anlegen"}
      </button>
    </form>
  );
}
