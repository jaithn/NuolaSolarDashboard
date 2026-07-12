"use client";

import { useActionState } from "react";
import { erfasseExterneRechnungAction, type ExterneRechnungFormState } from "./actions";

const initialState: ExterneRechnungFormState = {};

export function ExterneRechnungForm() {
  const [state, formAction, pending] = useActionState(erfasseExterneRechnungAction, initialState);
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && <div className="form-notice">{state.success}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ext-empfaenger">Empfänger</label>
          <input id="ext-empfaenger" name="empfaenger" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="ext-betreff">Betreff (optional)</label>
          <input id="ext-betreff" name="betreff" type="text" />
        </div>
        <div className="field">
          <label htmlFor="ext-datum">Ausstellungsdatum</label>
          <input id="ext-datum" name="ausstellungsdatum" type="date" required defaultValue={heute} />
        </div>
        <div className="field">
          <label htmlFor="ext-betrag">Betrag brutto (optional)</label>
          <input id="ext-betrag" name="betragBrutto" type="text" inputMode="decimal" placeholder="z. B. 123,45" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ext-notiz">Notiz (optional)</label>
        <input id="ext-notiz" name="notiz" type="text" />
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "22rem" }}>
        {pending ? "Wird erfasst…" : "Externe Rechnungsnummer vergeben"}
      </button>
    </form>
  );
}
