"use client";

import { useActionState } from "react";
import { createZuordnungAction, type ZuordnungFormState } from "../actions";

const initialState: ZuordnungFormState = {};

interface GeraetOption {
  id: string;
  bezeichnung: string;
  deviceId: string;
}

export function NewZuordnungForm({ einheitId, geraete }: { einheitId: string; geraete: GeraetOption[] }) {
  const [state, formAction, pending] = useActionState(createZuordnungAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="einheitId" value={einheitId} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="shellyGeraetId">Gerät</label>
          <select id="shellyGeraetId" name="shellyGeraetId" className="select-inline" required>
            {geraete.map((g) => (
              <option key={g.id} value={g.id}>
                {g.bezeichnung} ({g.deviceId})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="modus">Verrechnung</label>
          <select id="modus" name="modus" className="select-inline" defaultValue="ADDIEREN">
            <option value="ADDIEREN">Addieren (normaler Verbrauch)</option>
            <option value="SUBTRAHIEREN">Subtrahieren (z.B. Allgemeinstrom-Zwischenzähler)</option>
          </select>
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Zuordnung anlegen"}
      </button>
    </form>
  );
}
