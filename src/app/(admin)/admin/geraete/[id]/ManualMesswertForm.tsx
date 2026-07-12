"use client";

import { useActionState } from "react";
import { createManualMesswertAction, type ManualMesswertState } from "../actions";

const initialState: ManualMesswertState = {};

export function ManualMesswertForm({ geraetId }: { geraetId: string }) {
  const [state, formAction, pending] = useActionState(createManualMesswertAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && <div className="form-notice" role="status">{state.success}</div>}
      <input type="hidden" name="geraetId" value={geraetId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="zeitpunkt">Zeitpunkt</label>
          <input id="zeitpunkt" name="zeitpunkt" type="datetime-local" required />
        </div>
        <div className="field">
          <label htmlFor="kwh">Zählerstand (kWh)</label>
          <input id="kwh" name="kwh" type="number" step="0.001" min={0} required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "18rem" }}>
        {pending ? "Wird gespeichert…" : "Manuellen Messwert speichern"}
      </button>
    </form>
  );
}
