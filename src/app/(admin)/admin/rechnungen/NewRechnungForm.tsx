"use client";

import { useActionState } from "react";
import { createRechnungsentwurfAction, type RechnungFormState } from "./actions";

const initialState: RechnungFormState = {};

interface MietparteiOption {
  id: string;
  label: string;
}

export function NewRechnungForm({ mietparteien }: { mietparteien: MietparteiOption[] }) {
  const [state, formAction, pending] = useActionState(createRechnungsentwurfAction, initialState);
  const jetzt = new Date();
  const jahresanfang = `${jetzt.getFullYear()}-01-01`;
  const jahresende = `${jetzt.getFullYear()}-12-31`;

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mietparteiId">Mietpartei</label>
          <select id="mietparteiId" name="mietparteiId" className="select-inline" required>
            {mietparteien.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="typ">Typ</label>
          <select id="typ" name="typ" className="select-inline" defaultValue="JAHRESABRECHNUNG">
            <option value="JAHRESABRECHNUNG">Jahresabrechnung</option>
            <option value="SCHLUSSRECHNUNG">Schlussrechnung</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="von">Zeitraum von</label>
          <input id="von" name="von" type="date" required defaultValue={jahresanfang} />
        </div>
        <div className="field">
          <label htmlFor="bis">Zeitraum bis</label>
          <input id="bis" name="bis" type="date" required defaultValue={jahresende} />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird erstellt…" : "Entwurf erstellen"}
      </button>
    </form>
  );
}
