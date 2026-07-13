"use client";

import { useActionState, useState } from "react";
import { updateObjektAction, type ObjektFormState } from "../actions";

const initialState: ObjektFormState = {};

export function EditObjektForm({
  id,
  name,
  adresse,
  plz,
  ort,
  vermieterModus,
  vermieterName,
  vermieterAnschrift,
  vermieterPlz,
  vermieterOrt,
  bearbeiterName,
  geplanterLiefertermin,
  hatWaermepumpe,
}: {
  id: string;
  name: string;
  adresse: string;
  plz: string;
  ort: string;
  vermieterModus: "PRO_OBJEKT" | "PRO_EINHEIT";
  vermieterName: string | null;
  vermieterAnschrift: string | null;
  vermieterPlz: string;
  vermieterOrt: string;
  bearbeiterName: string | null;
  geplanterLiefertermin: string; // YYYY-MM-DD oder ""
  hatWaermepumpe: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateObjektAction, initialState);
  const [modus, setModus] = useState<"PRO_OBJEKT" | "PRO_EINHEIT">(vermieterModus);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" defaultValue={name} required />
        </div>
        <div className="field">
          <label htmlFor="adresse">Straße &amp; Hausnummer</label>
          <input id="adresse" name="adresse" type="text" defaultValue={adresse} required />
        </div>
        <div className="field">
          <label htmlFor="plz">PLZ</label>
          <input id="plz" name="plz" type="text" defaultValue={plz} required inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="ort">Ort</label>
          <input id="ort" name="ort" type="text" defaultValue={ort} required />
        </div>
        <div className="field">
          <label htmlFor="bearbeiterName">Bearbeiter:in (Firma)</label>
          <input id="bearbeiterName" name="bearbeiterName" type="text" defaultValue={bearbeiterName ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="geplanterLiefertermin">Geplanter Liefertermin</label>
          <input id="geplanterLiefertermin" name="geplanterLiefertermin" type="date" defaultValue={geplanterLiefertermin} />
        </div>
      </div>

      <div className="field">
        <label>
          <input type="checkbox" name="hatWaermepumpe" defaultChecked={hatWaermepumpe} /> Im Haus wird eine Wärmepumpe
          genutzt
        </label>
      </div>

      <div className="field">
        <label htmlFor="vermieterModus">Vermieter:in (für die Ergänzung zum Mietvertrag)</label>
        <select
          id="vermieterModus"
          name="vermieterModus"
          className="select-inline"
          value={modus}
          onChange={(e) => setModus(e.target.value as "PRO_OBJEKT" | "PRO_EINHEIT")}
        >
          <option value="PRO_OBJEKT">Ein:e Vermieter:in für das ganze Objekt</option>
          <option value="PRO_EINHEIT">Je Wohneinheit ein:e eigene:r Vermieter:in</option>
        </select>
      </div>

      {modus === "PRO_OBJEKT" ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="vermieterName">Vermieter:in (Name)</label>
            <input id="vermieterName" name="vermieterName" type="text" defaultValue={vermieterName ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="vermieterAnschrift">Vermieter:in (Straße &amp; Hausnr.)</label>
            <input
              id="vermieterAnschrift"
              name="vermieterAnschrift"
              type="text"
              defaultValue={vermieterAnschrift ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="vermieterPlz">Vermieter:in (PLZ)</label>
            <input id="vermieterPlz" name="vermieterPlz" type="text" inputMode="numeric" defaultValue={vermieterPlz} />
          </div>
          <div className="field">
            <label htmlFor="vermieterOrt">Vermieter:in (Ort)</label>
            <input id="vermieterOrt" name="vermieterOrt" type="text" defaultValue={vermieterOrt} />
          </div>
        </div>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Die/der Vermieter:in wird je Wohneinheit erfasst (siehe die jeweilige Einheit).
        </p>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
