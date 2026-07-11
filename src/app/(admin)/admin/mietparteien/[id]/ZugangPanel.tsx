"use client";

import { useActionState } from "react";
import { createZugangAction, resetZugangAction, type ZugangState } from "../actions";

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
  const [createState, createAction, createPending] = useActionState(createZugangAction, initialState);
  const [resetState, resetAction, resetPending] = useActionState(resetZugangAction, initialState);

  const result = createState.username ? createState : resetState.username ? resetState : null;

  // Frisch angelegt/zurueckgesetzt: Zugangsdaten einmalig anzeigen + PDF.
  if (result?.username && result.password) {
    return (
      <div>
        <div className="form-notice">
          {result.wurdeZurueckgesetzt
            ? "Zugang zurückgesetzt – ein neues Passwort wurde erzeugt."
            : "Zugang angelegt."}{" "}
          Bitte notieren Sie Benutzername und Passwort jetzt – das Passwort wird aus
          Sicherheitsgründen nicht gespeichert und kann nicht erneut angezeigt werden.
        </div>
        {result.emailFehler && (
          <div className="form-error">
            Hinweis: Die E-Mail an den Mieter konnte nicht versendet werden ({result.emailFehler}). Die
            Zugangsdaten unten sind trotzdem gültig – bitte per Brief/PDF zustellen.
          </div>
        )}
        <table className="data-table" style={{ maxWidth: "28rem", marginBottom: "1rem" }}>
          <tbody>
            <tr>
              <th>Benutzername</th>
              <td style={{ fontFamily: "var(--font-mono)" }}>{result.username}</td>
            </tr>
            <tr>
              <th>Einmal-Passwort</th>
              <td style={{ fontFamily: "var(--font-mono)" }}>{result.password}</td>
            </tr>
          </tbody>
        </table>
        <form action={`/api/mietparteien/${mietparteiId}/willkommen-pdf`} method="post" target="_blank">
          <input type="hidden" name="benutzername" value={result.username} />
          <input type="hidden" name="passwort" value={result.password} />
          <button className="btn" type="submit" style={{ maxWidth: "20rem" }}>
            Willkommensbrief als PDF herunterladen
          </button>
        </form>
      </div>
    );
  }

  if (hasZugang) {
    return (
      <div>
        <p>
          Zugang vorhanden (Benutzername: <strong>{username}</strong>
          {mustChangePassword ? ", Passwortänderung beim nächsten Login noch ausstehend" : ""}).
        </p>
        {resetState.error && <div className="form-error">{resetState.error}</div>}
        <form action={resetAction}>
          <input type="hidden" name="mietparteiId" value={mietparteiId} />
          <button className="btn-small" type="submit" disabled={resetPending}>
            {resetPending ? "Wird zurückgesetzt…" : "Zugang zurücksetzen (neues Passwort)"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {createState.error && <div className="form-error">{createState.error}</div>}
      <p>Für diese Mietpartei existiert noch kein Dashboard-Zugang.</p>
      <form action={createAction}>
        <input type="hidden" name="mietparteiId" value={mietparteiId} />
        <button className="btn-small" type="submit" disabled={createPending}>
          {createPending ? "Wird angelegt…" : "Zugang anlegen & per E-Mail versenden"}
        </button>
      </form>
    </>
  );
}
