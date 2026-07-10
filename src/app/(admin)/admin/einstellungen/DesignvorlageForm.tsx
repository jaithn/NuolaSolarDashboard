"use client";

import { useActionState } from "react";
import { updateDesignvorlageAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = {};

export function DesignvorlageForm(props: {
  primaerfarbe: string;
  sekundaerfarbe: string;
  fusszeileText: string | null;
  logoPfad: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateDesignvorlageAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}

      {props.logoPfad && (
        <p>
          Aktuelles Logo: <img src={props.logoPfad} alt="Firmenlogo" style={{ maxHeight: "3rem" }} />
        </p>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="logo">Logo hochladen (PNG/JPEG/SVG)</label>
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" />
        </div>
        <div className="field">
          <label htmlFor="primaerfarbe">Primärfarbe</label>
          <input id="primaerfarbe" name="primaerfarbe" type="color" defaultValue={props.primaerfarbe} />
        </div>
        <div className="field">
          <label htmlFor="sekundaerfarbe">Sekundärfarbe</label>
          <input id="sekundaerfarbe" name="sekundaerfarbe" type="color" defaultValue={props.sekundaerfarbe} />
        </div>
        <div className="field">
          <label htmlFor="fusszeileText">Fußzeile (z.B. Bankverbindung)</label>
          <input id="fusszeileText" name="fusszeileText" type="text" defaultValue={props.fusszeileText ?? ""} />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
