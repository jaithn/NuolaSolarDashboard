"use client";

import { useActionState } from "react";
import { updateProfilAction, type ProfilFormState } from "./actions";

const initialState: ProfilFormState = {};

interface ProfilFormProps {
  email: string;
  emailVerifiziert: boolean;
  emailPending: string | null;
  telefon: string | null;
}

export function ProfilForm({ email, emailVerifiziert, emailPending, telefon }: ProfilFormProps) {
  const [state, formAction, pending] = useActionState(updateProfilAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      {state.success && <div className="form-notice" role="status">{state.success}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="email">E-Mail-Adresse</label>
          <input id="email" name="email" type="email" defaultValue={email} aria-describedby="email-status" />
          <p id="email-status" className="price-breakdown">
            {emailVerifiziert ? "Bestätigt." : "Noch nicht bestätigt."}
            {emailPending ? ` Änderung auf „${emailPending}" wartet auf Bestätigung per E-Mail.` : ""}
            {" "}Bei Änderung senden wir einen Bestätigungslink an die neue Adresse.
          </p>
        </div>
        <div className="field">
          <label htmlFor="telefon">Telefonnummer</label>
          <input id="telefon" name="telefon" type="tel" defaultValue={telefon ?? ""} />
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
