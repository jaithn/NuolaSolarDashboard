"use client";

import { useActionState } from "react";
import { updateEinheitAction, type ObjektFormState } from "../../objekte/actions";

const initialState: ObjektFormState = {};

export function EditEinheitForm({
  id,
  bezeichnung,
  vermieterProEinheit,
  vermieterName,
  vermieterAnschrift,
}: {
  id: string;
  bezeichnung: string;
  vermieterProEinheit: boolean;
  vermieterName: string | null;
  vermieterAnschrift: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateEinheitAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung der Einheit</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required defaultValue={bezeichnung} />
        </div>
        {vermieterProEinheit && (
          <>
            <div className="field">
              <label htmlFor="vermieterName">Vermieter:in (Name)</label>
              <input id="vermieterName" name="vermieterName" type="text" defaultValue={vermieterName ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="vermieterAnschrift">Vermieter:in (Anschrift)</label>
              <input
                id="vermieterAnschrift"
                name="vermieterAnschrift"
                type="text"
                defaultValue={vermieterAnschrift ?? ""}
              />
            </div>
          </>
        )}
      </div>
      {vermieterProEinheit && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Vermieter:in dieser Wohneinheit (für die Ergänzung zum Mietvertrag).
        </p>
      )}
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
