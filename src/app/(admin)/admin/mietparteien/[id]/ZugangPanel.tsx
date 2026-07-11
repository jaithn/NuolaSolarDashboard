"use client";

import { useActionState } from "react";
import { createZugangAction, type ZugangState } from "../actions";

const initialState: ZugangState = {};

export function ZugangPanel({
  mietparteiId,
  hasZugang,
  username,
  mustChangePassword,
}: {
  mietparteiId: string;
  hasZugang: boolean;
  username?: string;
  mustChangePassword?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createZugangAction, initialState);

  // Frisch angelegt: Zugangsdaten einmalig anzeigen + Willkommensbrief anbieten.
  if (state.username && state.password) {
    return (
      <div>
        <div className="form-notice">
          Zugang angelegt und die Zugangsdaten per E-Mail versendet. Bitte notieren Sie Benutzername
          und Passwort jetzt – das Passwort wird aus Sicherheitsgründen nicht gespeichert und kann
          nicht erneut angezeigt werden.
        </div>
        <table className="data-table" style={{ maxWidth: "28rem", marginBottom: "1rem" }}>
          <tbody>
            <tr>
              <th>Benutzername</th>
              <td style={{ fontFamily: "var(--font-mono)" }}>{state.username}</td>
            </tr>
            <tr>
              <th>Einmal-Passwort</th>
              <td style={{ fontFamily: "var(--font-mono)" }}>{state.password}</td>
            </tr>
          </tbody>
        </table>
        <form action={`/api/mietparteien/${mietparteiId}/willkommen-pdf`} method="post" target="_blank">
          <input type="hidden" name="benutzername" value={state.username} />
          <input type="hidden" name="passwort" value={state.password} />
          <button className="btn" type="submit" style={{ maxWidth: "20rem" }}>
            Willkommensbrief als PDF herunterladen
          </button>
        </form>
      </div>
    );
  }

  if (hasZugang) {
    return (
      <p>
        Zugang vorhanden (Benutzername: <strong>{username}</strong>
        {mustChangePassword ? ", Passwortänderung beim nächsten Login noch ausstehend" : ""}).
      </p>
    );
  }

  return (
    <>
      {state.error && <div className="form-error">{state.error}</div>}
      <p>Für diese Mietpartei existiert noch kein Dashboard-Zugang.</p>
      <form action={formAction}>
        <input type="hidden" name="mietparteiId" value={mietparteiId} />
        <button className="btn-small" type="submit" disabled={pending}>
          {pending ? "Wird angelegt…" : "Zugang anlegen & per E-Mail versenden"}
        </button>
      </form>
    </>
  );
}
