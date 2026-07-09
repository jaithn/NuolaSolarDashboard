"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="currentPassword">Aktuelles Passwort</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="newPassword">Neues Passwort</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="field">
        <label htmlFor="newPasswordRepeat">Neues Passwort wiederholen</label>
        <input
          id="newPasswordRepeat"
          name="newPasswordRepeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Wird gespeichert…" : "Passwort ändern"}
      </button>
    </form>
  );
}
