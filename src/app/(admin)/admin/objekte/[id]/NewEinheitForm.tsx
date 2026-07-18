"use client";

import { useActionState, useState } from "react";
import { createEinheitAction } from "../actions";
import type { ObjektFormState } from "../actions";
import { ZweiterNameFeld } from "@/components/ZweiterNameFeld";
import { EinheitTypFeld } from "../EinheitTypFeld";

const initialState: ObjektFormState = {};

export function NewEinheitForm({
  objektId,
  vermieterProEinheit,
}: {
  objektId: string;
  vermieterProEinheit: boolean;
}) {
  const [state, formAction, pending] = useActionState(createEinheitAction, initialState);
  const [typ, setTyp] = useState<"WOHNEINHEIT" | "ALLGEMEINSTROM" | "WAERMEPUMPE">("WOHNEINHEIT");
  const zeigeVermieter = vermieterProEinheit && typ === "WOHNEINHEIT";

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="objektId" value={objektId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required placeholder="Wohnung 1.OG links" />
        </div>
        <EinheitTypFeld typ={typ} onChange={setTyp} />
        {zeigeVermieter && (
          <>
            <div className="field">
              <label htmlFor="vermieterName">Vermieter:in (Name)</label>
              <input id="vermieterName" name="vermieterName" type="text" />
              <ZweiterNameFeld label="Zweite:r Vermieter:in (Name)" buttonLabel="+ Zweite:r Vermieter:in" />
            </div>
            <div className="field">
              <label htmlFor="vermieterAnschrift">Vermieter:in (Straße &amp; Hausnr.)</label>
              <input id="vermieterAnschrift" name="vermieterAnschrift" type="text" />
            </div>
            <div className="field">
              <label htmlFor="vermieterPlz">Vermieter:in (PLZ)</label>
              <input id="vermieterPlz" name="vermieterPlz" type="text" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="vermieterOrt">Vermieter:in (Ort)</label>
              <input id="vermieterOrt" name="vermieterOrt" type="text" />
            </div>
          </>
        )}
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Einheit anlegen"}
      </button>
    </form>
  );
}
