"use client";

import { useActionState } from "react";
import { sendTestMailAction, type TestMailState } from "./actions";

const initialState: TestMailState = {};

export function TestMailForm() {
  const [state, formAction, pending] = useActionState(sendTestMailAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && <div className="form-notice">{state.success}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="to">Test-E-Mail an</label>
          <input id="to" name="to" type="email" required placeholder="test@example.com" />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gesendet…" : "Test-E-Mail senden"}
      </button>
    </form>
  );
}
