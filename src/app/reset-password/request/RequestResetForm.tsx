"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type RequestResetState } from "./actions";

const initialState: RequestResetState = {};

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.submitted) {
    return (
      <div className="form-notice">
        Falls dieser Benutzername existiert, wurde eine E-Mail mit einem Link zum Zurücksetzen
        verschickt. Bitte prüfen Sie Ihr Postfach.
      </div>
    );
  }

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="username">Benutzername</label>
        <input id="username" name="username" type="text" autoComplete="username" required />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Wird gesendet…" : "Link zum Zurücksetzen senden"}
      </button>
      <a className="muted-link" href="/login">
        Zurück zum Login
      </a>
    </form>
  );
}
