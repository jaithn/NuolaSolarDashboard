"use client";

import { useActionState, useState } from "react";
import { updateObjektAction, type ObjektFormState } from "../actions";
import { useCloseOnSaved } from "@/components/PanelClose";
import { ZweiterNameFeld } from "@/components/ZweiterNameFeld";
import { VermieterAnredeFirma } from "@/components/VermieterAnredeFirma";
import { ObjektZusatzFelder } from "@/components/ObjektZusatzFelder";
import { GrundversorgerFelder } from "@/components/GrundversorgerFelder";

const initialState: ObjektFormState = {};

export function EditObjektForm({
  id,
  name,
  adresse,
  plz,
  ort,
  vermieterModus,
  vermieterName,
  vermieterName2,
  vermieterAnrede,
  vermieterAnrede2,
  vermieterFirma,
  vermieterAnschrift,
  vermieterPlz,
  vermieterOrt,
  oeffentlicherZaehler,
  hausverwaltungName,
  hausverwaltungAnschrift,
  hausverwaltungPlz,
  hausverwaltungOrt,
  hausverwaltungAnsprechperson,
  hausverwaltungTelefon,
  hausverwaltungEmail,
  ergaenzungUnterzeichner,
  grundversorgerName,
  grundversorgerTarif,
  grundversorgerGrundpreisBrutto,
  grundversorgerArbeitspreisBrutto,
  grundversorgerStand,
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
  vermieterName2: string | null;
  vermieterAnrede: string | null;
  vermieterAnrede2: string | null;
  vermieterFirma: string | null;
  vermieterAnschrift: string | null;
  vermieterPlz: string;
  vermieterOrt: string;
  oeffentlicherZaehler: string | null;
  hausverwaltungName: string | null;
  hausverwaltungAnschrift: string | null;
  hausverwaltungPlz: string;
  hausverwaltungOrt: string;
  hausverwaltungAnsprechperson: string | null;
  hausverwaltungTelefon: string | null;
  hausverwaltungEmail: string | null;
  ergaenzungUnterzeichner: string;
  grundversorgerName: string | null;
  grundversorgerTarif: string | null;
  grundversorgerGrundpreisBrutto: number | null;
  grundversorgerArbeitspreisBrutto: number | null;
  grundversorgerStand: string; // YYYY-MM-DD oder ""
  bearbeiterName: string | null;
  geplanterLiefertermin: string; // YYYY-MM-DD oder ""
  hatWaermepumpe: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateObjektAction, initialState);
  useCloseOnSaved(state.savedNonce);
  const [modus, setModus] = useState<"PRO_OBJEKT" | "PRO_EINHEIT">(vermieterModus);

  return (
    // key mit savedNonce: erzwingt nach dem Speichern einen Remount, damit die
    // kontrollierten/defaultValue-<select>-Felder nicht durch den React-19-Formular-
    // Reset auf den ersten Options-Wert zurueckspringen (Anzeige = gespeicherter Wert).
    <form action={formAction} key={state.savedNonce ?? "form"}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.savedNonce && <div className="form-notice" role="status">Änderungen gespeichert.</div>}
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
        </div>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
          Die/der Vermieter:in wird je Wohneinheit erfasst (siehe die jeweilige Einheit).
        </p>
      )}

      <ObjektZusatzFelder
        oeffentlicherZaehler={oeffentlicherZaehler ?? ""}
        hausverwaltungName={hausverwaltungName ?? ""}
        hausverwaltungAnschrift={hausverwaltungAnschrift ?? ""}
        hausverwaltungPlz={hausverwaltungPlz}
        hausverwaltungOrt={hausverwaltungOrt}
        hausverwaltungAnsprechperson={hausverwaltungAnsprechperson ?? ""}
        hausverwaltungTelefon={hausverwaltungTelefon ?? ""}
        hausverwaltungEmail={hausverwaltungEmail ?? ""}
        ergaenzungUnterzeichner={ergaenzungUnterzeichner}
      />

      <GrundversorgerFelder
        name={grundversorgerName ?? ""}
        tarif={grundversorgerTarif ?? ""}
        grundpreisBrutto={grundversorgerGrundpreisBrutto != null ? String(grundversorgerGrundpreisBrutto) : ""}
        arbeitspreisBrutto={grundversorgerArbeitspreisBrutto != null ? String(grundversorgerArbeitspreisBrutto) : ""}
        stand={grundversorgerStand}
      />

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
