"use client";

import { useActionState } from "react";
import { batchEntwuerfeAction, type BatchFormState } from "./actions";

const initialState: BatchFormState = {};

export function BatchEntwuerfeForm() {
  const [state, formAction, pending] = useActionState(batchEntwuerfeAction, initialState);
  const jetzt = new Date();
  const jahresanfang = `${jetzt.getFullYear()}-01-01`;
  const jahresende = `${jetzt.getFullYear()}-12-31`;

  return (
    <div>
      <form action={formAction}>
        {state.error && <div className="form-error">{state.error}</div>}
        {/* Der Sammel-Lauf erzeugt bewusst NUR Jahresabrechnungen. Schluss-
           rechnungen entstehen einzeln beim Auszug/Mieterwechsel und werden
           hier daher nicht angeboten. */}
        <input type="hidden" name="typ" value="JAHRESABRECHNUNG" />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="batch-von">Zeitraum von</label>
            <input id="batch-von" name="von" type="date" required defaultValue={jahresanfang} />
          </div>
          <div className="field">
            <label htmlFor="batch-bis">Zeitraum bis</label>
            <input id="batch-bis" name="bis" type="date" required defaultValue={jahresende} />
          </div>
        </div>
        <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "22rem" }}>
          {pending ? "Wird erstellt…" : "Entwürfe für alle aktiven Einheiten erzeugen"}
        </button>
      </form>

      {state.erstellt && (
        <div className="form-notice" style={{ marginTop: "1rem" }}>
          {state.erstellt.length} Entwurf/Entwürfe erstellt
          {state.erstellt.length > 0 && (
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
              {state.erstellt.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.uebersprungen && state.uebersprungen.length > 0 && (
        <div className="form-error" style={{ marginTop: "0.75rem" }}>
          Übersprungen:
          <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
            {state.uebersprungen.map((u, i) => (
              <li key={i}>
                {u.bezeichner}: {u.grund}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
