"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="username">Benutzername</label>
        <input id="username" name="username" type="text" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Anmelden…" : "Anmelden"}
      </button>
      <a className="muted-link" href="/reset-password/request">
        Passwort vergessen?
      </a>
    </form>
  );
}
