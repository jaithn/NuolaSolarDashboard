"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="form-notice">
        Ihr Passwort wurde geändert. Sie können sich jetzt <Link href="/login">anmelden</Link>.
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="token" value={token} />
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
        {pending ? "Wird gespeichert…" : "Passwort setzen"}
      </button>
    </form>
  );
}
