"use client";

import { useActionState } from "react";
import { createManualMesswertAction, type ManualMesswertState } from "../actions";

const initialState: ManualMesswertState = {};

export function ManualMesswertForm({ geraetId, phasen }: { geraetId: string; phasen: string[] }) {
  const [state, formAction, pending] = useActionState(createManualMesswertAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && <div className="form-notice">{state.success}</div>}
      <input type="hidden" name="geraetId" value={geraetId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="phase">Phase</label>
          <input
            id="phase"
            name="phase"
            type="text"
            required
            list="phasen-liste"
            defaultValue={phasen[0] ?? "a"}
            placeholder="a / b / c bzw. 0 / 1 / 2"
          />
          <datalist id="phasen-liste">
            {phasen.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
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
