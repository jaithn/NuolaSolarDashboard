"use client";

import { useActionState, useState } from "react";
import { NewObjektForm } from "./NewObjektForm";
import { GeraetForm } from "../geraete/GeraetForm";
import { EinheitTypFeld, type EinheitTyp } from "./EinheitTypFeld";
import { istVermietbareEinheit } from "./einheitTyp";
import { createEinheitAction, type ObjektFormState } from "./actions";
import { ZweiterNameFeld } from "@/components/ZweiterNameFeld";
import { VermieterAnredeFirma } from "@/components/VermieterAnredeFirma";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";

interface ObjektOption {
  id: string;
  name: string;
  vermieterProEinheit: boolean;
}

const initialState: ObjektFormState = {};

/**
 * Seitentitel „Objekte" mit +-Anlege-Menü. Die Auswahl (Objekt / Einheit / Gerät)
 * klappt das jeweilige Formular direkt unter dem Titel auf. Ersetzt das frühere
 * dauerhafte „Neu anlegen"-Panel am Seitenende.
 */
export function StammdatenAnlegenPanel({ objekte }: { objekte: ObjektOption[] }) {
  const [offen, setOffen] = useState<string | null>(null);
  const keineObjekte = objekte.length === 0;

  return (
    <div>
      <SeitentitelAnlegen
        titel="Objekte"
        offen={offen}
        onSelect={setOffen}
        items={[
          { key: "objekt", label: "Neues Objekt" },
          { key: "einheit", label: "Neue Einheit", disabled: keineObjekte },
          { key: "geraet", label: "Neues Gerät", disabled: keineObjekte },
        ]}
      />

      {offen && (
        <div className="section">
          {offen === "objekt" && (
            <>
              <h2 style={{ marginTop: 0 }}>Neues Objekt</h2>
              <NewObjektForm />
            </>
          )}
          {offen === "einheit" && (
            <>
              <h2 style={{ marginTop: 0 }}>Neue Einheit</h2>
              <NewEinheitMitAuswahl objekte={objekte} />
            </>
          )}
          {offen === "geraet" && (
            <>
              <h2 style={{ marginTop: 0 }}>Neues Gerät</h2>
              <GeraetForm mode="create" objekte={objekte} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewEinheitMitAuswahl({ objekte }: { objekte: ObjektOption[] }) {
  const [state, formAction, pending] = useActionState(createEinheitAction, initialState);
  const [objektId, setObjektId] = useState(objekte[0]?.id ?? "");
  const [typ, setTyp] = useState<EinheitTyp>("WOHNEINHEIT");
  // Vermieter-Felder nur bei echten Wohneinheiten in „pro Wohneinheit"-Objekten.
  const vermieterProEinheit = objekte.find((o) => o.id === objektId)?.vermieterProEinheit ?? false;
  const zeigeVermieter = vermieterProEinheit && istVermietbareEinheit(typ);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="einheit-objektId">Objekt</label>
          <select
            id="einheit-objektId"
            name="objektId"
            className="select-inline"
            value={objektId}
            onChange={(e) => setObjektId(e.target.value)}
            required
          >
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="einheit-bezeichnung">Bezeichnung</label>
          <input id="einheit-bezeichnung" name="bezeichnung" type="text" required placeholder="Wohnung 1.OG links" />
        </div>
        <EinheitTypFeld typ={typ} onChange={setTyp} idPrefix="einheit-" />
        {zeigeVermieter && (
          <>
            <div className="field">
              <label htmlFor="einheit-vermieterName">Vermieter:in (Name)</label>
              <input id="einheit-vermieterName" name="vermieterName" type="text" />
              <ZweiterNameFeld
                id="einheit-vermieterName2"
                label="Zweite:r Vermieter:in (Name)"
                buttonLabel="+ Zweite:r Vermieter:in"
              />
            </div>
            <div className="field">
              <label htmlFor="einheit-vermieterAnschrift">Vermieter:in (Straße &amp; Hausnr.)</label>
              <input id="einheit-vermieterAnschrift" name="vermieterAnschrift" type="text" />
            </div>
            <div className="field">
              <label htmlFor="einheit-vermieterPlz">Vermieter:in (PLZ)</label>
              <input id="einheit-vermieterPlz" name="vermieterPlz" type="text" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="einheit-vermieterOrt">Vermieter:in (Ort)</label>
              <input id="einheit-vermieterOrt" name="vermieterOrt" type="text" />
            </div>
            <VermieterAnredeFirma idPrefix="einheit-" />
          </>
        )}
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Einheit anlegen"}
      </button>
    </form>
  );
}
