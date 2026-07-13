"use client";

import { useActionState } from "react";
import { syncVertragstexteAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = {};

export function VertragstexteSync() {
  const [state, action, pending] = useActionState(syncVertragstexteAction, initialState);
  return (
    <div>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && (
        <div className="form-notice" role="status">
          {state.success}
        </div>
      )}
      <form action={action}>
        <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "24rem" }}>
          {pending ? "Wird eingelesen…" : "Texte aus dem Dokumente-Ordner einlesen"}
        </button>
      </form>
    </div>
  );
}
