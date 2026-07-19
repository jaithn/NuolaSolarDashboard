"use client";

import { useActionState, useState } from "react";
import { updateEinheitAction, type ObjektFormState } from "../../objekte/actions";
import { EinheitTypFeld, type EinheitTyp } from "../../objekte/EinheitTypFeld";
import { istVermietbareEinheit } from "../../objekte/einheitTyp";
import { ZweiterNameFeld } from "@/components/ZweiterNameFeld";
import { VermieterAnredeFirma } from "@/components/VermieterAnredeFirma";

const initialState: ObjektFormState = {};

export function EditEinheitForm({
  id,
  bezeichnung,
  typ: typInitial,
  vermieterProEinheit,
  vermieterName,
  vermieterName2,
  vermieterAnrede,
  vermieterAnrede2,
  vermieterFirma,
  vermieterAnschrift,
  vermieterPlz,
  vermieterOrt,
}: {
  id: string;
  bezeichnung: string;
  typ: EinheitTyp;
  vermieterProEinheit: boolean;
  vermieterName: string | null;
  vermieterName2: string | null;
  vermieterAnrede: string | null;
  vermieterAnrede2: string | null;
  vermieterFirma: string | null;
  vermieterAnschrift: string | null;
  vermieterPlz: string;
  vermieterOrt: string;
}) {
  const [state, formAction, pending] = useActionState(updateEinheitAction, initialState);
  const [typ, setTyp] = useState<EinheitTyp>(typInitial);
  const zeigeVermieter = vermieterProEinheit && istVermietbareEinheit(typ);

  return (
    // key mit savedNonce: erzwingt nach dem Speichern einen Remount, damit das
    // kontrollierte Typ-<select> nicht durch den React-19-Formular-Reset auf den
    // ersten Wert zurueckspringt (Anzeige = gespeicherter Wert).
    <form action={formAction} key={state.savedNonce ?? "form"}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.savedNonce && <div className="form-notice" role="status">Änderungen gespeichert.</div>}
      <input type="hidden" name="id" value={id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung der Einheit</label>
          <input id="bezeichnung" name="bezeichnung" type="text" required defaultValue={bezeichnung} />
        </div>
        <EinheitTypFeld typ={typ} onChange={setTyp} />
        {zeigeVermieter && (
          <>
            <div className="field">
              <label htmlFor="vermieterName">Vermieter:in (Name)</label>
              <input id="vermieterName" name="vermieterName" type="text" defaultValue={vermieterName ?? ""} />
              <ZweiterNameFeld
                label="Zweite:r Vermieter:in (Name)"
                buttonLabel="+ Zweite:r Vermieter:in"
                defaultValue={vermieterName2 ?? ""}
              />
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
            <VermieterAnredeFirma
              anredeDefault={vermieterAnrede ?? ""}
              anrede2Default={vermieterAnrede2 ?? ""}
              firmaDefault={vermieterFirma ?? ""}
            />
          </>
        )}
      </div>
      {zeigeVermieter && (
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
